const express = require("express");
const router = express.Router();
const FineService = require("../../../services/football/FineService");

class FineController {
    constructor() {
        this.router = router;
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/', this.index.bind(this));
        this.router.post('/:id/confirm', this.confirm.bind(this));
    }

    async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            
            const filter = {};
            if (req.query.status && req.query.status !== 'all') {
                filter.status = req.query.status;
            }

            const result = await FineService.getFines(filter, page, limit);

            res.render('admin/football/fine/index', { 
                fines: result.data,
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                filterStatus: req.query.status || 'all',
                layout: 'admin/layout'
            });
        } catch (error) {
            console.error('Error in FineController index:', error);
            res.status(500).send('Server Error');
        }
    }

    async confirm(req, res) {
        try {
            const { id } = req.params;
            await FineService.confirmPayment(id);
            res.redirect('/admin/fine');
        } catch (error) {
            console.error('Error in FineController confirm:', error);
            res.status(500).send('Server Error');
        }
    }
}

module.exports = new FineController().router;
