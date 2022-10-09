const { Op } = require('sequelize');
const { sequelize } = require('../model');

const getUnpayedJobs = async (req, res) => {
    const { Contract, Job } = req.app.get('models');
    const unpaidJobs = await Job.findAll({
        include: {
            model: Contract,
            where: {
                [Op.or]: [
                    { ContractorId: req.profile.id },
                    { ClientId: req.profile.id },
                ],
                status: 'in_progress',
            },
            attributes: [],
        },
        where: {
            paid: null,
        },
    });

    return res.json(unpaidJobs);
};

const updateJob = async (req, res, next) => {
    const { Contract, Job, Profile } = req.app.get('models');
    // Check if this is a client user role
    if (req.profile.type !== 'client') {
        return res.status(403).json('Only clients are able to pay to contractors, not vice versa');
    }

    const transaction = await sequelize.transaction();
    const { job_id: id } = req.params;

    const job = await Job.findOne({
        include: {
            model: Contract,
            include: {
                model: Profile,
                as: 'Client',
            },
        },
        where: {
            id,
            // This condition was not mentioned, but I believe it makes sense
            // that only unpaid job might have effect on client's and contractor's balances
            paid: null,
        },
        lock: true,
        transaction,
    });

    if (!job) {
        return res.status(404).json('Job was not found');
    }

    // Check if the job belongs to the client
    if (job.Contract.Client.id !== Number(id)) {
        return res.status(403).json('You are not permitted to update the contract which is not yours');
    }

    // Checking the balance condition
    if (job.Contract.Client.balance >= job.price) {
        try {
            const contractor = await Profile.findOne({
                where: {
                    id: job.Contract.ContractorId,
                },
                lock: true,
                transaction,
            });
            const client = await Profile.findOne({
                where: {
                    id: job.Contract.ClientId,
                },
            });

            await Promise.all([
                Profile.update(
                    {
                        balance: contractor.balance + job.price,
                    },
                    {
                        where: { id: contractor.id },
                        transaction,
                    },
                ),
                Profile.update(
                    {
                        balance: client.balance - job.price,
                    },
                    {
                        where: { id: client.id },
                        transaction,
                    },
                ),
                // Corresponding update of the job itself seems meaning for me
                // despite it was not described in requirements
                Job.update(
                    {
                        paid: true,
                        paymentDate: Date.now(),
                    },
                    {
                        where: { id: job.id },
                        transaction,
                    },
                ),
            ]);
            await transaction.commit();

            return res.status(200).send('Ok');
        } catch (err) {
            await transaction.rollback();
            res.status(500).json('Some internal error happend during update. Try again later');

            next(err);
        }
    } else {
        return res.status(400).json('Not enough money on your balance. Deposit to proceed.');
    }
};

module.exports = {
    getUnpayedJobs,
    updateJob,
};
