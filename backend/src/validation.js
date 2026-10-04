import {z} from 'zod';
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const password = z.string().min(12).refine(s => Buffer.byteLength(s, 'utf8') <= 72);
const email = z.string().trim().toLowerCase().email().max(254);
export const registration = z.strictObject({name: z.string().trim().min(1).max(80), email, password});
export const login = z.strictObject({email, password: z.string().min(1).refine(s => Buffer.byteLength(s, 'utf8') <= 72)});
export const roleChange = z.strictObject({role: z.enum(['student', 'driver'])});
export const vehicleInput = z.strictObject({
  displayName: z.string().trim().min(1).max(100), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/),
  active: z.boolean().optional(), simulated: z.boolean().optional(), assignedDriver: objectId.nullable().optional(),
});
export const vehiclePatch = vehicleInput.partial().refine(v => Object.keys(v).length > 0);
export const noticeInput = z.strictObject({
  title: z.string().trim().min(1).max(100), message: z.string().trim().min(1).max(1000),
  severity: z.enum(['info', 'warning', 'disruption']), activeFrom: z.string().datetime({offset: true}), activeUntil: z.string().datetime({offset: true}),
}).refine(v => new Date(v.activeUntil) > new Date(v.activeFrom));
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiFailure(422, 'INVALID_INPUT', 'Request fields are invalid.');
  return result.data;
}
export class ApiFailure extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
