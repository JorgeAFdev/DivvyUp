const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const secret = process.env.jwt_secret;

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        minlength: 3,
        maxlength: 100,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/.+\@.+\..+/, 'Please enter a valid email address'],
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
    },
    profilePicture: {  // Campo adicional para la foto
        type: String, // Guardará una URL o ruta de la imagen
        default: '', // Opcional: Valor por defecto en caso de no incluir imagen
    },
},
    { timestamps: true }
);

userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next()
});

userSchema.methods.comparePassword = async function (inputPassword) {
    return await bcrypt.compare(inputPassword, this.password);

};
userSchema.methods.generateJWT = function () {
    const today = new Date();
    const expirationDay = new Date();

    expirationDay.setDate(today.getDate() + 60);

    let payload = {
        id: this._id,
        name: this.name,
        email: this.email
    }
    return jwt.sign(payload, secret, {

    });
};



const User = mongoose.model('User', userSchema);

module.exports = User;

