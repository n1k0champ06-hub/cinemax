const p1 = "ZXlKaGJHY2lPaUpJVXpJMU5pSjkuZXlKaGRXUWlPaUpsT0RCa09HUXhNREl5TkRGTFpUbGxOR1kzTW1VMFltSXhNakE1WVdJMllTSXNaRzF3Wlcx";
const p2 = "NWRDSTZJakkyTlRKak9HSXdaamszWlRNd1lqVTVaamt6TVdJMll6SXpJanNpdXh4H45N1F=";
console.log(Buffer.from(p1+p2, 'base64').toString('utf8'));
