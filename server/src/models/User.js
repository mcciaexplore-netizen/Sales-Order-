const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['Owner', 'Manager', 'Staff'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLES, required: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    passwordResetToken: { type: String, default: null, select: false },
    passwordResetExpiry: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    business: this.business,
  };
};

const User = mongoose.model('User', userSchema);
User.ROLES = ROLES;

module.exports = User;
