
import React, { useState, FC } from 'react';
import { db, User } from '../database';
import bcrypt from 'bcryptjs';
import { LogIn, UsersRound } from 'lucide-react';
import PasswordRecoveryModal from '../components/auth/PasswordRecoveryModal';

interface LoginPageProps {
    onLoginSuccess: (user: User) => void;
}

const LoginPage: FC<LoginPageProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isRecovering, setIsRecovering] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!username || !password) {
            setError('Por favor, ingrese su cédula/correo y contraseña.');
            return;
        }

        try {
            const user = await db.users
                .where('cedula').equalsIgnoreCase(username)
                .or('correo').equalsIgnoreCase(username)
                .first();

            if (user && bcrypt.compareSync(password, user.contrasenaHash)) {
                onLoginSuccess(user);
            } else {
                setError('Usuario o contraseña incorrectos.');
            }
        } catch (err) {
            console.error(err);
            setError('Ocurrió un error al intentar iniciar sesión.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 space-y-6">
                <div className="text-center">
                    <UsersRound className="mx-auto h-12 w-auto text-dece-blue-600" />
                    <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Gestión del DECE
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Inicie sesión para continuar
                    </p>
                </div>
                <form className="space-y-6" onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="username" className="sr-only">Cédula o Correo</label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            required
                            className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-dece-blue-500 focus:border-dece-blue-500"
                            placeholder="Cédula o Correo Electrónico"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="sr-only">Contraseña</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-dece-blue-500 focus:border-dece-blue-500"
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 text-center">{error}</p>
                    )}

                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                            <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-dece-blue-600 focus:ring-dece-blue-500 border-gray-300 rounded" />
                            <label htmlFor="remember-me" className="ml-2 block text-gray-900 dark:text-gray-300">Recordarme</label>
                        </div>
                        <a href="#" onClick={(e) => { e.preventDefault(); setIsRecovering(true); }} className="font-medium text-dece-blue-600 hover:text-dece-blue-500">
                            ¿Olvidó su contraseña?
                        </a>
                    </div>

                    <div>
                        <button type="submit" className="w-full flex justify-center items-center gap-2 btn-primary py-3">
                            <LogIn size={20} />
                            Iniciar Sesión
                        </button>
                    </div>
                </form>
            </div>
            {isRecovering && (
                <PasswordRecoveryModal isOpen={isRecovering} onClose={() => setIsRecovering(false)} />
            )}
        </div>
    );
};

export default LoginPage;
