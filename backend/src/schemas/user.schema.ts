import mongoose, { HydratedDocument, InferSchemaType, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        minlength: 3,
        maxlength: 40,
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
        // Opt-out: no query returns the hash unless it asks with select('+password').
        // Only the login does. Projecting at each call site instead only protects
        // the call sites someone remembered.
        select: false,
    },
    profilePicture: {  // Campo adicional para la foto
        type: String, // Guardará una URL o ruta de la imagen
        default: '', // Opcional: Valor por defecto en caso de no incluir imagen
    },
},
    { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export interface UserMethods {
    comparePassword(inputPassword: string): Promise<boolean>;
    generateJWT(): string;
}

type UserModel = Model<UserDoc, {}, UserMethods>;

userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next()
});

userSchema.methods.comparePassword = async function (this: HydratedDocument<UserDoc>, inputPassword: string) {
    return await bcrypt.compare(inputPassword, this.password);

};
userSchema.methods.generateJWT = function (this: HydratedDocument<UserDoc>) {
    const today = new Date();
    const expirationDay = new Date();

    expirationDay.setDate(today.getDate() + 60);

    let payload = {
        id: this._id,
        name: this.name,
        email: this.email
    }
    return jwt.sign(payload, process.env.jwt_secret as string, {

    });
};



const User = mongoose.model<UserDoc, UserModel>('User', userSchema);

export default User;
