const express = require('express');
const bodyParser = require('body-parser');
const helment = require('helmet');
const {
    check, body, query,
} = require('express-validator');

const { sequelize } = require('./model');
const { getProfile } = require('./middleware/getProfile');
const { getById, getAllUserContracts } = require('./controllers/contracts');
const { getUnpayedJobs, updateJob } = require('./controllers/jobs');
const { topUpBalance } = require('./controllers/balance');
const { getBestProfession, getBestClients } = require('./controllers/admin');

const app = express();
app.use(helment());
app.use(bodyParser.json());
app.set('sequelize', sequelize);
app.set('models', sequelize.models);

app.use(getProfile);

/**
 * @returns contract by id if it belongs to the contractor or the client
 */
app.get(
    '/contracts/:id',
    (req, res, next) => {
        check(req.params.id)
            .notEmpty()
            .trim()
            .escape()
            .withMessage('Contract ID was not provided');
        next();
    },
    getById,
);

app.get(
    '/contracts',
    getAllUserContracts,
);

app.get(
    '/jobs/unpaid',
    getUnpayedJobs,
);

app.post(
    '/jobs/:job_id/pay',
    updateJob,
);

app.post(
    '/balances/deposit/:userId',
    body('depositAmount')
        .exists()
        .notEmpty()
        .withMessage('Deposit amount was not provided'),
    topUpBalance,
);

app.get(
    '/admin/best-profession',
    query('start')
        .isDate()
        .trim()
        .escape(),
    query('end')
        .isDate()
        .trim()
        .escape(),
    getBestProfession,
);

app.get(
    '/admin/best-clients',
    query('start')
        .isDate()
        .trim()
        .escape(),
    query('end')
        .isDate()
        .trim()
        .escape(),
    query('limit')
        .isNumeric()
        .optional()
        .trim()
        .escape(),
    getBestClients,
);

app.use((req, res) => res.status(404).json('There is no such data you are requesting for'));

app.use((err, req, res) => {
    console.error(err);
    return res.status(500).json('Some internal error');
});

module.exports = app;
