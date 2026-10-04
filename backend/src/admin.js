import express from 'express';
import {User, Vehicle, Notice, publicUser, publicVehicle, publicNotice} from './models.js';
import {ApiFailure, parse, objectId, roleChange, vehicleInput, vehiclePatch, noticeInput} from './validation.js';
const missing = () => new ApiFailure(404, 'NOT_FOUND', 'The requested record does not exist.');
export function adminRouter() {
  const admin = express.Router();
  admin.get('/users', async (req, res) => res.json({users: (await User.find().sort({name: 1}).limit(100)).map(publicUser)}));
  admin.patch('/users/:id/role', async (req, res) => {
    const id = parse(objectId, req.params.id);
    const {role} = parse(roleChange, req.body);
    const user = await User.findById(id);
    if (!user) throw missing();
    if (user.role === 'admin') throw new ApiFailure(403, 'PROTECTED_ADMIN', 'Admin roles are managed by the trusted seed process.');
    if (role === 'student' && await Vehicle.exists({assignedDriver: id})) throw new ApiFailure(409, 'DRIVER_ASSIGNED', 'Unassign the driver before changing their role.');
    user.role = role; await user.save(); res.json({user: publicUser(user)});
  });
  async function checkDriver(id) {
    if (id && !await User.exists({_id: id, role: 'driver'})) throw new ApiFailure(422, 'INVALID_DRIVER', 'Select an existing driver account.');
  }
  admin.get('/vehicles', async (req, res) => res.json({vehicles: (await Vehicle.find().sort({code: 1}).limit(100)).map(v => publicVehicle(v, true))}));
  admin.post('/vehicles', async (req, res) => {
    const input = parse(vehicleInput, req.body); await checkDriver(input.assignedDriver);
    if (input.assignedDriver === null) delete input.assignedDriver;
    const vehicle = await Vehicle.create(input); res.status(201).json({vehicle: publicVehicle(vehicle, true)});
  });
  admin.patch('/vehicles/:id', async (req, res) => {
    const id = parse(objectId, req.params.id); const input = parse(vehiclePatch, req.body); await checkDriver(input.assignedDriver);
    const update = {$set: input};
    if (input.assignedDriver === null) { delete input.assignedDriver; update.$unset = {assignedDriver: 1}; }
    const vehicle = await Vehicle.findByIdAndUpdate(id, update, {returnDocument: 'after', runValidators: true});
    if (!vehicle) throw missing(); res.json({vehicle: publicVehicle(vehicle, true)});
  });
  admin.delete('/vehicles/:id', async (req, res) => {
    if (!await Vehicle.findByIdAndDelete(parse(objectId, req.params.id))) throw missing(); res.status(204).end();
  });
  admin.get('/notices', async (req, res) => res.json({notices: (await Notice.find().sort({activeFrom: -1}).limit(100)).map(publicNotice)}));
  admin.post('/notices', async (req, res) => { const notice = await Notice.create(parse(noticeInput, req.body)); res.status(201).json({notice: publicNotice(notice)}); });
  admin.patch('/notices/:id', async (req, res) => {
    const notice = await Notice.findByIdAndUpdate(parse(objectId, req.params.id), parse(noticeInput, req.body), {returnDocument: 'after', runValidators: true});
    if (!notice) throw missing(); res.json({notice: publicNotice(notice)});
  });
  admin.delete('/notices/:id', async (req, res) => {
    if (!await Notice.findByIdAndDelete(parse(objectId, req.params.id))) throw missing(); res.status(204).end();
  });
  return admin;
}
