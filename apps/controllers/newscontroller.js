const express = require("express");
const router = express.Router();
const Parser = require('rss-parser');
const parser = new Parser();

class NewsController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }
    
    initializeRoutes() {
        this.router.get("/", this.index.bind(this));
    }
    
    async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 6;
            const skip = (page - 1) * limit;

            // Fetch news from CBS Sports RSS Feed (Better images support)
            let feed = await parser.parseURL('https://www.cbssports.com/rss/headlines/');
            
            // Clean up data
            feed.items.forEach(item => {
                if (item.title) item.title = item.title.trim();
                if (item.link) item.link = item.link.trim();
                if (item.content) item.content = item.content.trim();
                if (item.contentSnippet) item.contentSnippet = item.contentSnippet.trim();
            });

            const totalItems = feed.items.length;
            const totalPages = Math.ceil(totalItems / limit);
            const paginatedItems = feed.items.slice(skip, skip + limit);
    
            res.render("news.ejs", { 
                items: paginatedItems, 
                currentPage: page,
                totalPages: totalPages,
                error: null 
            });
        } catch (error) {
            console.error("Error fetching news:", error);
            res.render("news.ejs", { items: [], currentPage: 1, totalPages: 0, error: "Không thể tải tin tức lúc này. Vui lòng thử lại sau." });
        }
    }
}

module.exports = new NewsController().router;
