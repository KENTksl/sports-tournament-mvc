const Fine = require('../../models/football/Fine');
const { FINE_SETTINGS } = require('../../common/constants');

class FineService {
    /**
     * Sync fines based on match events
     * @param {Object} tournament - The tournament object (populated with teams)
     * @param {String} matchId - The ID of the match
     * @param {Array} events - List of events from the match (cards, goals, etc.)
     */
    async syncMatchFines(tournament, matchId, events) {
        if (!events || !Array.isArray(events)) return;

        try {
            // Find the match in the tournament to get context
            let currentMatch = null;
            let groupName = '';
            
            if (tournament.fixtures) {
                for (const group of tournament.fixtures) {
                    const m = group.matches.find(m => m.id === matchId);
                    if (m) {
                        currentMatch = m;
                        groupName = group.group || '';
                        break;
                    }
                }
            }

            if (!currentMatch) return;

            // Helper to find team ID by name
            const getTeamId = (teamName) => {
                if (!tournament.teams) return null;
                const team = tournament.teams.find(t => t.name === teamName);
                return team ? team.id : null;
            };

            // 1. Get all existing fines for this match
            const existingFines = await Fine.find({ matchId: matchId });
            
            // 2. Identify current card events
            // Event type from frontend is 'yellow' or 'red'
            const cardEvents = events.filter(e => e.type === 'yellow' || e.type === 'red');
            const processedFineIds = new Set();

            // 3. Sync Logic
            for (const event of cardEvents) {
                const isYellow = event.type === 'yellow';
                const amount = isYellow ? FINE_SETTINGS.YELLOW_CARD_AMOUNT : FINE_SETTINGS.RED_CARD_AMOUNT;
                // event.team is usually 'team1' or 'team2'
                const teamName = event.team === 'team1' ? currentMatch.team1 : currentMatch.team2;
                const teamId = getTeamId(teamName);
                
                if (teamId && event.playerId) {
                    const dbType = isYellow ? 'yellow_card' : 'red_card';

                    // Find matching existing fine
                    const matchingFine = existingFines.find(f => 
                        !processedFineIds.has(f._id.toString()) &&
                        f.memberId === event.playerId &&
                        f.type === dbType
                    );

                    if (matchingFine) {
                        // Update existing fine
                        matchingFine.reason = `${isYellow ? 'Thẻ vàng' : 'Thẻ đỏ'} phút ${event.minute}`;
                        matchingFine.amount = amount;
                        await matchingFine.save();
                        processedFineIds.add(matchingFine._id.toString());
                    } else {
                        // Create new fine
                        const fine = new Fine({
                            memberId: event.playerId,
                            memberName: event.playerName,
                            teamId: teamId,
                            teamName: teamName,
                            tournamentId: tournament._id,
                            matchId: matchId,
                            matchLabel: groupName,
                            type: dbType,
                            amount: amount,
                            reason: `${isYellow ? 'Thẻ vàng' : 'Thẻ đỏ'} phút ${event.minute}`,
                            status: FINE_SETTINGS.STATUS_PENDING
                        });
                        await fine.save();
                    }
                }
            }

            // 4. Remove fines that are no longer present in events
            const finesToDelete = existingFines.filter(f => 
                !processedFineIds.has(f._id.toString()) && 
                (f.type === 'yellow_card' || f.type === 'red_card')
            );

            for (const fine of finesToDelete) {
                await Fine.findByIdAndDelete(fine._id);
            }

        } catch (error) {
            console.error('FineService syncMatchFines error:', error);
            throw error;
        }
    }

    /**
     * Get fines with pagination and filtering
     * @param {Object} filter - Query filter
     * @param {Number} page - Current page
     * @param {Number} limit - Items per page
     */
    async getFines(filter = {}, page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit;
            const totalDocs = await Fine.countDocuments(filter);
            const totalPages = Math.ceil(totalDocs / limit);
            const fines = await Fine.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('tournamentId');
            
            return {
                data: fines,
                currentPage: page,
                totalPages: totalPages,
                totalDocs: totalDocs
            };
        } catch (error) {
            console.error('FineService getFines error:', error);
            throw error;
        }
    }

    /**
     * Confirm fine payment
     * @param {String} id - Fine ID
     */
    async confirmPayment(id) {
        try {
            return await Fine.findByIdAndUpdate(id, { 
                status: FINE_SETTINGS.STATUS_PAID,
                paidAt: new Date()
            }, { new: true });
        } catch (error) {
            console.error('FineService confirmPayment error:', error);
            throw error;
        }
    }
}

module.exports = new FineService();
