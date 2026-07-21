export interface ReportPayload {
  reportId?: string;
  movieTitle: string;
  movieSlug: string;
  tmdbId?: string | number;
  mediaType?: string; // 'movie' | 'tv'
  season?: number;
  episodeName?: string;
  serverName?: string;
  streamUrl?: string;
  streamType?: string; // 'hls' | 'embed'
  quality?: string;
  currentTime?: number;
  duration?: number;
  errorType: string; // 'play' | 'lag' | 'sub' | 'audio' | 'other'
  errorDetails?: string;
  userAgent?: string;
  screenResolution?: string;
  timestamp: string;
  consoleLogs?: string[];
  networkState?: {
    online: boolean;
    effectiveType?: string;
  };
}

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1523007458719694898/Dm7HuW025WgM28TSyqBgR6CMohRVvVBQYVzSiTeL8Kh1cx2P0Q0UO-CRCvbNR2qqDOEf';

const getErrorTypeName = (type: string): string => {
  switch (type) {
    case 'play':
      return '❌ Không thể phát video (Link hỏng)';
    case 'lag':
      return '🐌 Giật lag / Load chậm';
    case 'sub':
      return '📝 Lỗi phụ đề';
    case 'audio':
      return '🔊 Lỗi âm thanh / Lệch tiếng';
    default:
      return '✍️ Lỗi khác / Góp ý';
  }
};

const getErrorColor = (type: string): number => {
  switch (type) {
    case 'play':
      return 15548997; // Crimson Red
    case 'lag':
      return 16761035; // Amber Yellow
    case 'sub':
      return 10181046; // Purple
    case 'audio':
      return 3447003; // Blue
    default:
      return 9807270; // Grey
  }
};

export const sendReportToDiscord = async (payload: ReportPayload): Promise<boolean> => {
  try {
    const errorName = getErrorTypeName(payload.errorType);
    const color = getErrorColor(payload.errorType);
    
    // Format details safely
    const detailsText = payload.errorDetails?.trim() || 'Không có mô tả chi tiết.';
    const mediaTypeText = payload.mediaType === 'tv' ? '📺 TV Show' : '🎬 Movie';
    const episodeText = payload.episodeName 
      ? `Mùa ${payload.season || 1} - Tập ${payload.episodeName}` 
      : 'Bản Full / Movie';
    
    // Playback progress representation
    let playbackText = 'Chưa vào trình phát';
    if (payload.currentTime !== undefined && payload.duration !== undefined) {
      const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      };
      const ratio = payload.duration > 0 ? ((payload.currentTime / payload.duration) * 100).toFixed(1) : '0';
      playbackText = `⏳ ${formatTime(payload.currentTime)} / ${formatTime(payload.duration)} (${ratio}%)`;
    }

    // Format logs snippet for Discord embed field (max 950 chars)
    let logsFieldText = '*Không có console logs recorded*';
    if (payload.consoleLogs && payload.consoleLogs.length > 0) {
      const recentSnippet = payload.consoleLogs.slice(-8).join('\n');
      logsFieldText = recentSnippet.length > 950 ? recentSnippet.substring(recentSnippet.length - 950) : recentSnippet;
    }

    const networkInfo = payload.networkState 
      ? `Online: ${payload.networkState.online ? '✅' : '❌'}${payload.networkState.effectiveType ? ` (${payload.networkState.effectiveType})` : ''}`
      : 'N/A';

    // Build the Discord fields
    const fields = [
      { name: 'Report ID', value: payload.reportId ? `\`${payload.reportId}\`` : 'N/A', inline: true },
      { name: 'Loại', value: mediaTypeText, inline: true },
      { name: 'Tập phim', value: episodeText, inline: true },
      { name: 'Phim', value: `**${payload.movieTitle}**\n*(Slug: \`${payload.movieSlug}\` | TMDB: \`${payload.tmdbId || 'N/A'}\`)*`, inline: false },
      { name: 'Nguồn / Server', value: payload.serverName || 'N/A', inline: true },
      { name: 'Chất lượng', value: payload.quality || 'N/A', inline: true },
      { name: 'Loại luồng', value: payload.streamType ? `\`${payload.streamType}\`` : 'N/A', inline: true },
      { name: 'Tiến trình', value: playbackText, inline: true },
      { name: 'Mạng internet', value: networkInfo, inline: true },
      { name: 'Chi tiết lỗi', value: `\`\`\`\n${detailsText}\n\`\`\``, inline: false },
      { name: '📜 Console Logs Gần Nhất', value: `\`\`\`log\n${logsFieldText}\n\`\`\``, inline: false },
      { name: 'Browser / OS', value: `\`${payload.userAgent || 'Unknown'}\``, inline: false }
    ];

    // Structured JSON for AI Agent easy parsing
    const agentMetadata = {
      action: 'cinemax_bug_report',
      reportId: payload.reportId,
      movie: {
        title: payload.movieTitle,
        slug: payload.movieSlug,
        tmdbId: payload.tmdbId,
        mediaType: payload.mediaType
      },
      playback: {
        season: payload.season,
        episode: payload.episodeName,
        server: payload.serverName,
        quality: payload.quality,
        streamType: payload.streamType,
        streamUrl: payload.streamUrl,
        currentTime: payload.currentTime,
        duration: payload.duration
      },
      error: {
        type: payload.errorType,
        details: payload.errorDetails
      },
      client: {
        userAgent: payload.userAgent,
        screen: payload.screenResolution,
        timestamp: payload.timestamp,
        network: payload.networkState
      },
      logs: payload.consoleLogs || []
    };

    const discordPayload = {
      content: `⚠️ **BÁO CÁO LỖI PHIM MỚI**\nLoại sự cố: **${errorName}**`,
      embeds: [
        {
          title: `Chi tiết sự cố: ${payload.errorType.toUpperCase()}`,
          description: `Báo cáo được gửi lúc ${new Date(payload.timestamp).toLocaleString('vi-VN')}`,
          color: color,
          fields: fields,
          footer: {
            text: 'Cinemax OS Report Assistant'
          }
        },
        {
          title: '🤖 Agent Context Data (JSON)',
          description: `\`\`\`json\n${JSON.stringify(agentMetadata, null, 2)}\n\`\`\``.substring(0, 4000),
          color: 3066993 // Green color indicating structured data
        }
      ]
    };

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(discordPayload)
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send report to Discord:', error);
    return false;
  }
};
