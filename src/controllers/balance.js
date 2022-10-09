const { validationResult } = require('express-validator');

const topUpBalance = async (req, res, next) => {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        return res.status(400).json({ validationErrors: validationErrors.array() });
    }

    // I assume the bussiness logic restricts contractors from topping up their balance
    if (req.profile.type !== 'client') {
        return res.status(403).json('Only clients are able to pay to contractors, not vice versa');
    }

    try {
        const { Contract, Job, Profile } = req.app.get('models');
        const clientContracts = await Contract.findAll({
            include: {
                model: Job,
                where: {
                    paid: null,
                },
                attributes: ['id', 'price'],
            },
            where: {
                ClientId: req.profile.id,
            },
            attributes: ['id'],
            raw: true,
        });

        if (!clientContracts) {
            return res.status(403).json('You don\'t have open jobs, so no depositing allowed');
        }

        let maxDepositValue = 0;
        clientContracts.forEach(
            (job) => {
                maxDepositValue += Number(job['Jobs.price']);
            },
        );

        // Apply 25% of currently opened unpaid jobs restriction
        maxDepositValue *= 0.25;

        if (maxDepositValue < Number(req.body.depositAmount)) {
            return res.status(401).json(`You are not allowed to deposit amount more than: ${maxDepositValue}`);
        }

        const client = await Profile.findOne({ where: { id: req.profile.id } });
        await client.increment('balance', { by: Number(req.body.depositAmount) });

        return res.status(200).json('Ok');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    topUpBalance,
};
