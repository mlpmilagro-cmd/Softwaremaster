
import React, { useState, FC } from 'react';
import { db, User } from '../../database';
import bcrypt from 'bcryptjs';
import Modal from '../shared/Modal';

interface PasswordRecoveryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PasswordRecoveryModal: FC<PasswordRecoveryModalProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState(1);
    const [identifier, setIdentifier] = useState('');
    const [user, setUser] = useState<User | null>(null);
    const [answers, setAnswers] = useState(['', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleFindUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const foundUser = await db.users
            .where('cedula').equalsIgnoreCase(identifier)
            .or('correo').equalsIgnoreCase(identifier)
            .first();

        if (foundUser && foundUser.preguntasSeguridad?.length === 2) {
            setUser(foundUser);
            setStep(2);
        } else {
            setError('Usuario no encontrado o sin preguntas de seguridad configuradas.');
        }
    };

    const handleVerifyAnswers = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!user || !user.preguntasSeguridad) return;

        const isAnswer1Correct = bcrypt.compareSync(answers[0], user.preguntasSeguridad[0].respuestaHash);
        const isAnswer2Correct = bcrypt.compareSync(answers[1], user.preguntasSeguridad[1].respuestaHash);

        if (isAnswer1Correct && isAnswer2Correct) {
            setStep(3);
        } else {
            setError('Una o más respuestas son incorrectas.');
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (newPassword.length < 4) {
            setError('La contraseña debe tener al menos 4 caracteres.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        if (!user) return;

        try {
            const salt = bcrypt.genSaltSync(10);
            const contrasenaHash = bcrypt.hashSync(newPassword, salt);
            await db.users.update(user.id!, { contrasenaHash });
            setMessage('Contraseña actualizada con éxito. Ya puede cerrar esta ventana e iniciar sesión.');
            setStep(4);
        } catch (err) {
            console.error(err);
            setError('No se pudo actualizar la contraseña.');
        }
    };
    
    const resetState = () => {
        setStep(1);
        setIdentifier('');
        setUser(null);
        setAnswers(['', '']);
        setNewPassword('');
        setConfirmPassword('');
        setMessage('');
        setError('');
        onClose();
    }

    return (
        <Modal isOpen={isOpen} onClose={resetState} title="Recuperar Contraseña">
            <div className="space-y-4">
                {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                {message && <p className="text-sm text-green-600 dark:text-green-400 text-center">{message}</p>}

                {step === 1 && (
                    <form onSubmit={handleFindUser} className="space-y-4">
                        <label>Ingrese su Cédula o Correo Electrónico</label>
                        <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700" required />
                        <div className="flex justify-end pt-2 gap-2">
                            <button type="button" onClick={resetState} className="btn-secondary">Cancelar</button>
                            <button type="submit" className="btn-primary">Buscar</button>
                        </div>
                    </form>
                )}

                {step === 2 && user && (
                    <form onSubmit={handleVerifyAnswers} className="space-y-4">
                        {user.preguntasSeguridad?.map((sq, index) => (
                            <div key={index}>
                                <label className="font-semibold">{sq.pregunta}</label>
                                <input type="text" value={answers[index]} onChange={(e) => { const newAnswers = [...answers]; newAnswers[index] = e.target.value; setAnswers(newAnswers); }} className="mt-1 w-full p-2 border rounded dark:bg-gray-700" required />
                            </div>
                        ))}
                        <div className="flex justify-end pt-2 gap-2">
                            <button type="button" onClick={resetState} className="btn-secondary">Cancelar</button>
                            <button type="submit" className="btn-primary">Verificar Respuestas</button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <label>Ingrese su Nueva Contraseña</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nueva Contraseña" className="w-full p-2 border rounded dark:bg-gray-700" required />
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar Contraseña" className="w-full p-2 border rounded dark:bg-gray-700" required />
                        <div className="flex justify-end pt-2 gap-2">
                            <button type="button" onClick={resetState} className="btn-secondary">Cancelar</button>
                            <button type="submit" className="btn-primary">Cambiar Contraseña</button>
                        </div>
                    </form>
                )}

                 {step === 4 && (
                    <div className="text-center">
                        <button onClick={resetState} className="btn-primary">Cerrar</button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default PasswordRecoveryModal;
