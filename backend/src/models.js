import mongoose from 'mongoose';
mongoose.set('bufferCommands', false);
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);
const {Schema} = mongoose;
const userSchema = new Schema({
  name: {type: String, required: true, maxlength: 80},
  email: {type: String, required: true, unique: true, lowercase: true},
  passwordHash: {type: String, required: true, select: false},
  role: {type: String, enum: ['student', 'driver', 'admin'], default: 'student', required: true},
}, {timestamps: true, strict: 'throw'});
const vehicleSchema = new Schema({
  displayName: {type: String, required: true, maxlength: 100},
  code: {type: String, required: true, unique: true},
  active: {type: Boolean, default: true}, simulated: {type: Boolean, default: true},
  assignedDriver: {type: Schema.Types.ObjectId, ref: 'User'},
}, {timestamps: true, strict: 'throw'});
vehicleSchema.index({assignedDriver: 1}, {unique: true, sparse: true});
const noticeSchema = new Schema({
  title: {type: String, required: true, maxlength: 100}, message: {type: String, required: true, maxlength: 1000},
  severity: {type: String, enum: ['info', 'warning', 'disruption'], required: true},
  activeFrom: {type: Date, required: true}, activeUntil: {type: Date, required: true},
}, {timestamps: true, strict: 'throw'});
export const User = mongoose.model('User', userSchema);
export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export const Notice = mongoose.model('Notice', noticeSchema);
export async function initializeIndexes() {
  for (const model of [User, Vehicle, Notice]) {
    await model.createCollection();
    await model.createIndexes();
  }
}
export function publicUser(u) { return {id: String(u._id), name: u.name, email: u.email, role: u.role}; }
export function publicVehicle(v, admin = false) {
  return {vehicleId: String(v._id), displayName: v.displayName, code: v.code, active: v.active, simulated: v.simulated,
    ...(admin ? {assignedDriver: v.assignedDriver ? String(v.assignedDriver) : null} : {})};
}
export function publicNotice(n) {
  return {id: String(n._id), title: n.title, message: n.message, severity: n.severity,
    activeFrom: n.activeFrom.toISOString(), activeUntil: n.activeUntil.toISOString()};
}
