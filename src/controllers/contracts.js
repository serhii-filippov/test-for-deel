const { Op } = require('sequelize');

const getById = async (req, res, next) => {
    const { Contract } = req.app.get('models');
    const { id } = req.params;

    try {
        const contract = await Contract.findOne({
            where: {
                id,
                [Op.or]: [
                    { ContractorId: req.profile.id },
                    { ClientId: req.profile.id },
                ],
            },
        });

        if (!contract) {
            return res.status(404).json('Nothing found').end();
        }

        return res.json(contract);
    } catch (err) {
        res.status(422).json('There were some error');
        next(err);
    }
};

const getAllUserContracts = async (req, res) => {
    const { Contract } = req.app.get('models');
    const contracts = await Contract.findAll({
        where: {
            [Op.or]: [
                { ContractorId: req.profile.id },
                { ClientId: req.profile.id },
            ],
            status: {
                [Op.not]: 'terminated',
            },
        },
    });

    return res.json(contracts);
};

module.exports = {
    getById,
    getAllUserContracts,
};
