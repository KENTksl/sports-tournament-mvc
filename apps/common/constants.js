const TOURNAMENT_MODES = {
    KNOCKOUT: 'Knockout',
    GROUP_STAGE: 'Group Stage',
    ROUND_ROBIN: 'Round Robin'
};

const TOURNAMENT_STATUS = {
    UPCOMING: 'upcoming',
    ONGOING: 'ongoing',
    COMPLETED: 'completed'
};

const MATCH_STATUS = {
    SCHEDULED: 'scheduled',
    FINISHED: 'finished',
    COMPLETED: 'completed' // sometimes used interchangeably with finished
};

const KNOCKOUT_ROUNDS = {
    FINAL: 'Chung Kết',
    SEMI_FINAL: 'Bán Kết',
    QUARTER_FINAL: 'Tứ Kết',
    ROUND_OF_16: 'Vòng 1/8',
    ROUND_OF_32: 'Vòng 1/16',
    THIRD_PLACE: 'Tranh Hạng 3'
};

const FINE_SETTINGS = {
    YELLOW_CARD_AMOUNT: 100000,
    RED_CARD_AMOUNT: 300000,
    STATUS_PENDING: 'pending',
    STATUS_PAID: 'paid',
    TYPE_YELLOW: 'yellow',
    TYPE_RED: 'red'
};

const AUTH_SETTINGS = {
    DEFAULT_ROLE: 'customer',
    TOKEN_EXPIRY: 86400,
    SALT_ROUNDS: 10
};

module.exports = {
    TOURNAMENT_MODES,
    TOURNAMENT_STATUS,
    MATCH_STATUS,
    KNOCKOUT_ROUNDS,
    FINE_SETTINGS,
    AUTH_SETTINGS
};
