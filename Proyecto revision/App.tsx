
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { db, User } from './database';
import type Dexie from 'dexie';
import ErrorBoundary from './components/shared/ErrorBoundary';
import LoadingSpinner from './components/shared/LoadingSpinner';

// Lazy load components to improve initial load time
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AdminRegistrationPage = lazy(() => import('./pages/AdminRegistrationPage'));
const MainLayout = lazy(() => import('./components/layout/MainLayout'));
const ProfileCompletionModal = lazy(() => import('./components/auth/ProfileCompletionModal'));
const OnboardingGuideModal = lazy(() => import('./components/auth/OnboardingGuideModal'));

const App = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showProfileCompletion, setShowProfileCompletion] = useState(false);
    const [isAdminRegister, setIsAdminRegister] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);

    useEffect(() => {
        const checkSession = async () => {
            try {
                // Ensure DB is open
                await (db as Dexie).open();
                
                // Check for Admin Registration URL
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('admin-register') === 'true') {
                    setIsAdminRegister(true);
                    setIsLoading(false);
                    return;
                }

                const userId = sessionStorage.getItem('currentUser');
                if (userId) {
                    const user = await db.users.get(Number(userId));
                    if (user) {
                        handleLoginSuccess(user);
                    }
                }
            } catch (error) {
                console.error("Failed to initialize app:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();
    }, []);

    const handleLoginSuccess = (user: User) => {
        // ALWAYS check for first login first. This is the activation step.
        if (user.primerInicio) {
            setCurrentUser(user);
            setShowProfileCompletion(true);
        } 
        // If it's not their first login, check if their account is active.
        else if (user.estado === 'Activo') {
            setCurrentUser(user);
            sessionStorage.setItem('currentUser', String(user.id!));
        } 
        // If it's not their first login and their account is NOT active (e.g., 'Pendiente')
        else {
            alert('Su cuenta no está activa. Contacte al administrador.');
            return;
        }
    };

    const handleProfileCompleted = (user: User) => {
        setShowProfileCompletion(false);
        // After profile is completed, show the onboarding guide.
        setShowOnboarding(true); 
        setCurrentUser(user);
        sessionStorage.setItem('currentUser', String(user.id!));
    };

    const handleLogout = () => {
        setCurrentUser(null);
        sessionStorage.removeItem('currentUser');
    };

    if (isLoading) {
        return <div className="h-screen w-screen flex items-center justify-center"><LoadingSpinner /></div>;
    }

    return (
        <ErrorBoundary>
            <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center"><LoadingSpinner /></div>}>
                {isAdminRegister ? (
                    <AdminRegistrationPage />
                ) : currentUser ? (
                    <>
                        <MainLayout currentUser={currentUser} onLogout={handleLogout} />
                        {showProfileCompletion && (
                            <ProfileCompletionModal
                                user={currentUser}
                                onProfileCompleted={handleProfileCompleted}
                            />
                        )}
                        {showOnboarding && (
                            <OnboardingGuideModal 
                                isOpen={showOnboarding}
                                onClose={() => setShowOnboarding(false)}
                            />
                        )}
                    </>
                ) : (
                    <LoginPage onLoginSuccess={handleLoginSuccess} />
                )}
            </Suspense>
        </ErrorBoundary>
    );
};

export default App;
