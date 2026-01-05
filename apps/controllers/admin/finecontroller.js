const express = require("express");
const router = express.Router();
const Fine = require('../../models/Fine');

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
            const skip = (page - 1) * limit;

            const filter = {};
            if (req.query.status && req.query.status !== 'all') {
                filter.status = req.query.status;
            }

            const totalDocs = await Fine.countDocuments(filter);
            const totalPages = Math.ceil(totalDocs / limit);

            const fines = await Fine.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('tournamentId');

            res.render('admin/fine/index', { 
                fines,
                currentPage: page,
                totalPages: totalPages,
                filterStatus: req.query.status || 'all',
                layout: 'admin/layout'
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    }

    async confirm(req, res) {
        try {
            const { id } = req.params;
            await Fine.findByIdAndUpdate(id, { 
                status: 'paid',
                paidAt: new Date()
            });
            res.redirect('/admin/fine');
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    }
}

module.exports = new FineController().router;
