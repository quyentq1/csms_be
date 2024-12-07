const Colour = require('../models/colour');

let create = async (req, res, next) => {
    let colour_name = req.body.colour_name;
    if (colour_name === undefined) return res.status(400).send('Color Name not exists');
    let colour = await Colour.findOne({ where: { colour_name } });
    if (colour) return res.status(409).send('Color Name exists');
    else {
        let newColour = await Colour.create({ colour_name });
        return res.send(newColour);
    }
}

let list = async (req, res, next) => {
    let colours = await Colour.findAll({
        attributes: ['colour_id', 'colour_name'],
        raw: true
    });
    return res.send(colours);
}

module.exports = {
    create,
    list,
};
