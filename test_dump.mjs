import https from "https";
https.get("https://phimapi.com/v1/api/the-loai/hanh-dong", res => {
    let data = "";
    res.on("data", c => data += c);
    res.on("end", () => {
        let json = JSON.parse(data);
        console.log("APP DOMAIN:", json.data.APP_DOMAIN_CDN_IMAGE);
        console.log("ITEM:", JSON.stringify(json.data.items[0]));
    });
});
