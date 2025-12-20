var express = require("express");
var router = express.Router();
var Parser = require('rss-parser');
var parser = new Parser();

router.get("/", async function(req, res){
    try {
        // Fetch news from CBS Sports RSS Feed (Better images support)
        let feed = await parser.parseURL('https://www.cbssports.com/rss/headlines/');
        
        // Clean up data
        feed.items.forEach(item => {
            if (item.title) item.title = item.title.trim();
            if (item.link) item.link = item.link.trim();
            if (item.content) item.content = item.content.trim();
            if (item.contentSnippet) item.contentSnippet = item.contentSnippet.trim();
        });

        res.render("news.ejs", { items: feed.items, error: null });
    } catch (error) {
        console.error("Error fetching news:", error);
        res.render("news.ejs", { items: [], error: "Không thể tải tin tức lúc này. Vui lòng thử lại sau." });
    }
});

module.exports = router;