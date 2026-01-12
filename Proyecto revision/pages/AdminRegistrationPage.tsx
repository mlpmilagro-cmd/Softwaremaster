
import React, { useState, FC } from 'react';
import { db, User, UserRole } from '../database';
import bcrypt from 'bcryptjs';
import { UserPlus, ShieldCheck } from 'lucide-react';

const AdminRegistrationPage: FC = () => {
    const [masterPassword, setMasterPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [formData, setFormData] = useState<Partial<User>>({
        rol: 'Profesional DECE',
        estado: 'Pendiente',
        primerInicio: true
    });
    const [message, setMessage] = useState('');

    const MASTER_PASSWORD = "DECE-ADMIN-2024";

    const handleMasterAuth = (e: React.FormEvent) => {
        e.preventDefault();
        if (masterPassword === MASTER_PASSWORD) {
            setIsAuthenticated(true);
            setMessage('');
        } else {
            setMessage('Contraseña maestra incorrecta.');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        const { nombreCompleto, cedula, correo, contrasenaHash: initialPassword, rol } = formData;

        if (!nombreCompleto || !cedula || !correo || !initialPassword || !rol) {
            setMessage('Todos los campos son obligatorios.');
            return;
        }

        try {
            const existingUser = await db.users.where('cedula').equals(cedula).or('correo').equals(correo).first();
            if (existingUser) {
                setMessage('La cédula o el correo ya están registrados.');
                return;
            }

            const salt = bcrypt.genSaltSync(10);
            const contrasenaHash = bcrypt.hashSync(initialPassword, salt);

            const newUser: User = {
                nombreCompleto,
                cedula,
                correo,
                contrasenaHash,
                rol: rol as UserRole,
                estado: 'Pendiente',
                primerInicio: true,
            };

            await db.users.add(newUser);
            setMessage(`Usuario ${nombreCompleto} creado con éxito. Su estado es 'Pendiente' y deberá completar su perfil al iniciar sesión.`);
            setFormData({ rol: 'Profesional DECE', estado: 'Pendiente', primerInicio: true }); // Reset form
        } catch (error) {
            console.error("Error creating user:", error);
            setMessage(`Error al crear usuario: ${error}`);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                <div className="max-w-sm w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
                    <form onSubmit={handleMasterAuth} className="space-y-4">
                        <h2 className="text-xl font-bold text-center flex items-center justify-center gap-2"><ShieldCheck/> Acceso de Administrador</h2>
                        <div>
                            <label htmlFor="masterPassword">Contraseña Maestra</label>
                            <input
                                id="masterPassword"
                                type="password"
                                value={masterPassword}
                                onChange={(e) => setMasterPassword(e.target.value)}
                                className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                required
                            />
                        </div>
                        {message && <p className="text-sm text-red-500">{message}</p>}
                        <button type="submit" className="w-full btn-primary">Autenticar</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
            <div className="max-w-lg w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
                <form onSubmit={handleRegister} className="space-y-4">
                    <h2 className="text-2xl font-bold text-center flex items-center justify-center gap-2"><UserPlus/> Registro Supervisado de Usuario</h2>
                    
                    <input name="nombreCompleto" value={formData.nombreCompleto || ''} onChange={handleChange} placeholder="Nombre Completo" required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    <input name="cedula" value={formData.cedula || ''} onChange={handleChange} placeholder="Número de Cédula" required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    <input name="correo" type="email" value={formData.correo || ''} onChange={handleChange} placeholder="Correo Electrónico" required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    <input name="contrasenaHash" value={formData.contrasenaHash || ''} onChange={handleChange} placeholder="Contraseña Inicial" required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    <select name="rol" value={formData.rol} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                        <option value="Profesional DECE">Profesional DECE</option>
                        <option value="Analista">Analista</option>
                        <option value="Coordinador">Coordinador</option>
                    </select>

                    {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
                    <button type="submit" className="w-full btn-primary">Crear Usuario</button>
                     <a href="/" className="block text-center text-sm text-dece-blue-600 hover:underline mt-4">Volver al inicio de sesión</a>
                </form>
            </div>
        </div>
    );
};

export default AdminRegistrationPage;
