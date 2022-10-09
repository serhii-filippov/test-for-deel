const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

const getBestProfession = async (req, res) => {
    const { Contract, Job, Profile } = req.app.get('models');
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        return res.status(400).json({ validationErrors: validationErrors.array() });
    }

    const { start, end } = req.query;
    const paidJobs = await Job.findAll({
        include: {
            model: Contract,
            attributes: ['id'],
            include: {
                model: Profile,
                as: 'Contractor',
                attributes: ['id'],
            },
        },
        where: {
            paid: true,
            paymentDate: {
                [Op.between]: [start, end],
            },
        },
        attributes: ['id', 'price'],
        raw: true,
    });

    const professionsMap = {};
    paidJobs.forEach((paidJob) => {
        // eslint-disable-next-line no-unsafe-optional-chaining
        const profession = paidJob['Contract.Contractor.profession'];
        if (professionsMap[profession] === undefined) {
            professionsMap[profession] = paidJob.price;
        } else {
            professionsMap[profession] += paidJob.price;
        }
    });

    let mostEarnedProfessionMap = {};
    Object.keys(professionsMap).forEach((profession) => {
        // Check if it's the 1st iteration and the map is empty
        if (Object.keys(mostEarnedProfessionMap).length === 0) {
            mostEarnedProfessionMap[profession] = professionsMap[profession];
        // if found greater number value, clean up the map; sorry for the dirty hack xD
        } else if (mostEarnedProfessionMap[profession] < professionsMap[profession]) {
            mostEarnedProfessionMap = {};
            mostEarnedProfessionMap[profession] = professionsMap[profession];
        }
    });

    return res.json(mostEarnedProfessionMap);
};

const getBestClients = async (req, res) => {
    const { Contract, Job, Profile } = req.app.get('models');

    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        return res.status(400).json({ validationErrors: validationErrors.array() });
    }

    // defaulting limit to desired 2; hardcoded, bad practice, but so far not seying the need
    // of creating some kind of config entity and put all the defaults there
    const { start, end, limit = 2 } = req.query;

    const paidJobs = await Job.findAll({
        include: {
            model: Contract,
            attributes: ['id'],
            include: {
                model: Profile,
                as: 'Client',
                attributes: ['id', 'firstName', 'lastName'],
            },
        },
        where: {
            paid: true,
            paymentDate: {
                [Op.between]: [start, end],
            },
        },
        // I'd add the offset and process data by junks,
        // but would have a time to make it once got the offer :)
        attributes: ['id', 'price'],
        raw: true,
    });

    const clientsMap = {};
    paidJobs.forEach((paidJob) => {
        const clientFullName = `${paidJob['Contract.Client.firstName']} ${paidJob['Contract.Client.lastName']}`;
        if (clientsMap[clientFullName] === undefined) {
            clientsMap[clientFullName] = paidJob.price;
        } else {
            clientsMap[clientFullName] += paidJob.price;
        }
    });

    const mostSpentClients = Object.keys(clientsMap).map(
        (clientName) => ({ clientName, totalSpent: clientsMap[clientName] }),
    );
    // Sort desc by total spendings
    mostSpentClients.sort(
        (client1, client2) => client2.totalSpent - client1.totalSpent,
    );

    // Apply limit
    // Wanted to use one more durty hack array.lenght = 2 (the limit)
    // but thought a single durty one is enough for that test
    return res.json(mostSpentClients.splice(0, limit));
};

module.exports = {
    getBestProfession,
    getBestClients,
};
