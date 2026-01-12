
import React, { useState, FC } from 'react';
import { db, User, SecurityQuestion } from '../../database';
import bcrypt from 'bcryptjs';
import Modal from '../shared/Modal';

interface ProfileCompletionModalProps {
    user: User;
    onProfileCompleted: (user: User) => void;
}

const SECURITY_QUESTIONS = [
    "¿Cuál es el nombre de su primera mascota?",
    "¿Cuál es el nombre de soltera de su madre?",
    "¿En qué ciudad nació?",
    "¿Cuál es su comida favorita?",
    "¿Cuál fue el modelo de su primer auto?",
];

const ProfileCompletionModal: FC<ProfileCompletionModalProps> = ({ user, onProfileCompleted }) => {
    const [formData, setFormData] = useState({
        cargo: '',
        telefono: '',
        direccion: '',
        correo: user.correo,
        nuevaContrasena: '',
        confirmarContrasena: ''
    });
    const [securityData, setSecurityData] = useState([
        { pregunta: '', respuesta: '' },
        { pregunta: '', respuesta: '' },
    ]);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSecurityChange = (index: number, field: 'pregunta' | 'respuesta', value: string) => {
        const newSecurityData = [...securityData];
        newSecurityData[index][field] = value;
        setSecurityData(newSecurityData);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validations
        if (!formData.cargo || !formData.telefono) {
            setError('El cargo y el teléfono son obligatorios.');
            return;
        }
        if (securityData.some(sq => !sq.pregunta || !sq.respuesta)) {
            setError('Debe configurar dos preguntas y respuestas de seguridad.');
            return;
        }
        if (securityData[0].pregunta === securityData[1].pregunta) {
            setError('Las preguntas de seguridad deben ser diferentes.');
            return;
        }
        if (formData.nuevaContrasena && formData.nuevaContrasena !== formData.confirmarContrasena) {
            setError('Las nuevas contraseñas no coinciden.');
            return;
        }
        
        try {
            const salt = bcrypt.genSaltSync(10);
            const preguntasSeguridad: SecurityQuestion[] = securityData.map(sq => ({
                pregunta: sq.pregunta,
                respuestaHash: bcrypt.hashSync(sq.respuesta, salt),
            }));

            const updatedUser: Partial<User> = {
                cargo: formData.cargo,
                telefono: formData.telefono,
                direccion: formData.direccion,
                correo: formData.correo,
                preguntasSeguridad: preguntasSeguridad,
                primerInicio: false, // Mark as completed
                estado: 'Activo'
            };

            if (formData.nuevaContrasena) {
                updatedUser.contrasenaHash = bcrypt.hashSync(formData.nuevaContrasena, salt);
            }

            await db.users.update(user.id!, updatedUser);
            onProfileCompleted({ ...user, ...updatedUser });

        } catch (err) {
            console.error(err);
            setError('Ocurrió un error al guardar su perfil.');
        }
    };

    return (
        <Modal isOpen={true} onClose={() => {}} title="Completa tu información para activar tu cuenta" size="xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Esta información es necesaria para el uso completo del sistema. Los campos de nombre y cédula no podrán ser modificados posteriormente.</p>
                
                <fieldset className="p-3 border rounded-md">
                    <legend className="px-2 font-semibold text-sm">Datos Personales</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label>Nombre Completo</label><input type="text" value={user.nombreCompleto} readOnly className="mt-1 w-full p-2 border rounded bg-gray-100 dark:bg-gray-700/50 dark:border-gray-600" /></div>
                        <div><label>Cédula</label><input type="text" value={user.cedula} readOnly className="mt-1 w-full p-2 border rounded bg-gray-100 dark:bg-gray-700/50 dark:border-gray-600" /></div>
                        <div><label>Cargo/Función en el DECE (*)</label><input type="text" name="cargo" value={formData.cargo} onChange={handleChange} required className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                        <div><label>Teléfono Personal (*)</label><input type="tel" name="telefono" value={formData.telefono} onChange={handleChange} required className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                        <div className="sm:col-span-2"><label>Correo Electrónico</label><input type="email" name="correo" value={formData.correo} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                        <div className="sm:col-span-2"><label>Dirección de Contacto</label><textarea name="direccion" value={formData.direccion} onChange={handleChange} rows={2} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                    </div>
                </fieldset>

                <fieldset className="p-3 border rounded-md">
                    <legend className="px-2 font-semibold text-sm">Preguntas de Seguridad (*)</legend>
                    <p className="text-xs text-gray-500 mb-2">Estas preguntas se usarán para recuperar su contraseña si la olvida.</p>
                    {securityData.map((_, index) => (
                        <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                            <select value={securityData[index].pregunta} onChange={(e) => handleSecurityChange(index, 'pregunta', e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                                <option value="">Seleccione la pregunta {index + 1}...</option>
                                {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                            </select>
                            <input type="text" value={securityData[index].respuesta} onChange={(e) => handleSecurityChange(index, 'respuesta', e.target.value)} placeholder={`Respuesta a la pregunta ${index + 1}`} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    ))}
                </fieldset>
                
                <fieldset className="p-3 border rounded-md">
                    <legend className="px-2 font-semibold text-sm">Cambiar Contraseña (Opcional)</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input type="password" name="nuevaContrasena" value={formData.nuevaContrasena} onChange={handleChange} placeholder="Nueva Contraseña" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        <input type="password" name="confirmarContrasena" value={formData.confirmarContrasena} onChange={handleChange} placeholder="Confirmar Nueva Contraseña" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                </fieldset>
                
                {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                <div className="flex justify-end pt-4">
                    <button type="submit" className="btn-primary">Guardar y Activar Cuenta</button>
                </div>
            </form>
        </Modal>
    );
};

export default ProfileCompletionModal;
