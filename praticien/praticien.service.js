const bcrypt = require('bcryptjs');
const db = require('db/dbMysql2');
const jwt = require('jsonwebtoken');
let consAuth = require("_const/auth");
const adresseService = require('./adresse.service');


module.exports = {
    getByIdComplet,
    getAll,
    getAllComplete,
    getById,
    create,
    update,
    delete: _delete,
    connect
};

async function getAll() {
    return await db.Praticien.findAll();
}

async function getAllComplete() {
    return await db.Praticien.findAll({ include: [{model: db.Adresse, as: 'Adresse'}]});
}

async function getById(id) {
    return await getPraticien(id);
}

async function getByIdComplet(id) {
    return await getByIdComplet(id);
}

async function create(params) {
    // TODO peut etre mettre une transaction afin errors to rollback car 2 creation adresse et praticien
    console.log('------------------DEB SERVICE PRATICIEN---------------  create params=' + params);
    // validate
    if (await db.Praticien.findOne({ where: { email: params.email } })) {
        throw 'Email "' + params.email + '" is already registered';
    }

    const adresse = await adresseService.create(params.adresse);
    console.log('------------------ SERVICE PRATICIEN 111 ---------------  adresse =' + adresse);
    
    const horaireService = require('./horairePraticien.service');
    const horairePraticien = await horaireService.create(params.horairePraticien);
    console.log('------------------ SERVICE PRATICIEN 112 ---------------  horaire =' + JSON.stringify(horairePraticien) );
    
    const praticien = new db.Praticien(params);
    console.log('------------------ SERVICE PRATICIEN 222---------------  praticien =' + praticien);


    // hash password
    praticien.motpasse = await bcrypt.hash(params.motpasse, 10);

    praticien.AdresseId = adresse.id;
    praticien.HorairePraticienId = horairePraticien.id;
    console.log('------------------ SERVICE PRATICIEN 333---------------  praticien.passwordHash =' + praticien.passwordHash);

    // save praticien
    await praticien.save();
    console.log('------------------FIN SERVICE PRATICIEN---------------  create');
    return praticien;
}

async function update(id, params) {
    const praticien = await getPraticien(id);

    // validate
    const usernameChanged = params.username && user.username !== params.username;
    if (usernameChanged && await db.Praticien.findOne({ where: { username: params.username } })) {
        throw 'Username "' + params.username + '" is already taken';
    }

    // hash password if it was entered
    if (params.password) {
        params.passwordHash = await bcrypt.hash(params.password, 10);
    }

    // copy params to Praticien and save
    Object.assign(praticien, params);
    await praticien.save();
}

async function _delete(id) {
    const praticien = await getPraticien(id);
    await praticien.destroy();
}

async function getPraticien(id) {
    const praticien = await db.Praticien.findByPk(id , { include: [{model: db.Adresse, as: 'Adresse'}]});
    if (!praticien) throw 'praticien not found';
    return praticien;
}

async function getByIdComplet(id) {
    const praticien = await db.Praticien.findByPk(id , { include: [{model: db.Adresse, as: 'Adresse'},{model: db.Profil, as: 'Profil'}]});
    
    praticien.Profil.dataImg = Buffer.from(praticien.Profil.dataImg).toString('base64');
    
    return praticien;
}

async function connect(params, res) {
    console.log('------------------DEB---------------  connect praticien servicepassword = ' + params.password);
    var passwordHash = await bcrypt.hash(params.password, 10);
    console.log('-------------------1--------------  connect praticien servicepasswordHash = ' + passwordHash);

    var praticien = await getUserByEmail(params.email);

    console.log('--------*************--THE praticien.HorairePraticienId = ' + praticien.HorairePraticienId);

    if (!praticien){ // TODO
        throw 'L email est inconnue';
    }
        

    console.log('-------------------2--------------  connect praticien servicepraticien.passwordHash = ' + praticien.passwordHash);

    bcrypt.compare(params.password, praticien.motpasse, (err, data) => {
        //if error than throw error
        if (err) throw err;
        //if both match than you can do anything
        if (data) {
            console.log('---------------3------------------  connect praticien serviceokk success ');

            let praticienToken = praticien;
            //use the payload to store information about the user such as username, user role, etc.
            let payload = { praticien: praticienToken };
            
            let accessToken = jwt.sign(payload, consAuth.ACCESS_TOKEN_SECRET, {
                algorithm: consAuth.ALGORITHM,
                expiresIn: consAuth.ACCESS_TOKEN_LIFE
            })

            //create the refresh token with the longer lifespan
            let refreshToken = jwt.sign(payload, consAuth.REFRESH_TOKEN_SECRET, {
                algorithm: consAuth.ALGORITHM,
                expiresIn: consAuth.REFRESH_TOKEN_LIFE
            })

            //send the access token to the client inside a cookie
            res.cookie(consAuth.ACCESS_TOKEN_NOM, accessToken, { secure: true, httpOnly: true })
            
            res.status(200).json({
                msg: "Login success",
                userId: praticien.id,
                token: accessToken
            });
        } else {

            message = "KO";
            console.log('---------------------------------  connect praticien serviceMot de passe incorrecte ');
            res.status(401).json({ msg: "Mot de passe incorrecte" })
            //throw 'Mot de passe incorrecte';
        }

    });
    return praticien;
}

async function getUserByEmail(email) {
    const praticient = await db.Praticien.findOne({ where: { email: email } });
    if (!praticient) throw 'Utilisateur Inconnu';
    return praticient;
}
