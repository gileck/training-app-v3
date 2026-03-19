import React, { useState } from 'react';
import { Eye, EyeOff, User, Mail, Lock, ArrowRight, UserPlus, AlertCircle } from 'lucide-react';
import { useAuthStore } from './store';
import { useLogin, useRegister } from './hooks';
import { useLoginFormValidator } from './useLoginFormValidator';
import { isNetworkError, cleanErrorMessage as cleanApiErrorMessage } from '../error-tracking/errorUtils';
import type { LoginFormState } from './types';
import { cn } from '@/client/lib/utils';

export const LoginForm = () => {
    const error = useAuthStore((state) => state.error);
    const setError = useAuthStore((state) => state.setError);

    const loginMutation = useLogin();
    const registerMutation = useRegister();

    const isLoading = loginMutation.isPending || registerMutation.isPending;

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form mode toggle
    const [isRegistering, setIsRegistering] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- form input before submission
    const [formData, setFormData] = useState<LoginFormState>({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for password visibility
    const [showPassword, setShowPassword] = useState(false);

    const { formErrors, validateForm, clearFieldError, resetFormErrors } = useLoginFormValidator(isRegistering, formData);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        clearFieldError(name as keyof LoginFormState);
        if (error || loginMutation.error || registerMutation.error) {
            setError(null);
            loginMutation.reset();
            registerMutation.reset();
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validateForm()) return;

        if (isRegistering) {
            registerMutation.mutate({
                username: formData.username,
                password: formData.password,
                ...(formData.email.trim() && { email: formData.email })
            });
        } else {
            loginMutation.mutate({
                username: formData.username,
                password: formData.password
            });
        }
    };

    const toggleMode = () => {
        setIsRegistering(!isRegistering);
        resetFormErrors();
        setError(null);
        loginMutation.reset();
        registerMutation.reset();
    };

    // Get error message - clean up technical jargon
    const rawError = error ||
        (loginMutation.error instanceof Error ? loginMutation.error.message : null) ||
        (registerMutation.error instanceof Error ? registerMutation.error.message : null);
    
    const displayError = rawError ? cleanErrorMessage(rawError) : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25 mb-4">
                    {isRegistering ? <UserPlus className="w-7 h-7 text-primary-foreground" /> : <User className="w-7 h-7 text-primary-foreground" />}
                </div>
                <h1 className="text-2xl font-bold text-foreground">
                    {isRegistering ? 'Create Account' : 'Welcome Back'}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {isRegistering ? 'Sign up to get started' : 'Sign in to continue'}
                </p>
            </div>

            {/* Error */}
            {displayError && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <p className="text-sm text-destructive">{displayError}</p>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                    <InputField
                        icon={<User className="w-5 h-5" />}
                        name="username"
                        placeholder="Username"
                        value={formData.username}
                        onChange={handleChange}
                        disabled={isLoading}
                        error={formErrors.username}
                        autoComplete="username"
                    />
                    
                    {isRegistering && (
                        <InputField
                            icon={<Mail className="w-5 h-5" />}
                            name="email"
                            type="email"
                            placeholder="Email (optional)"
                            value={formData.email}
                            onChange={handleChange}
                            disabled={isLoading}
                            error={formErrors.email}
                            autoComplete="email"
                        />
                    )}
                    
                    <InputField
                        icon={<Lock className="w-5 h-5" />}
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        value={formData.password}
                        onChange={handleChange}
                        disabled={isLoading}
                        error={formErrors.password}
                        autoComplete={isRegistering ? 'new-password' : 'current-password'}
                        rightElement={
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground/60 hover:text-muted-foreground" tabIndex={-1}>
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        }
                    />
                    
                    {isRegistering && (
                        <InputField
                            icon={<Lock className="w-5 h-5" />}
                            name="confirmPassword"
                            type="password"
                            placeholder="Confirm Password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            disabled={isLoading}
                            error={formErrors.confirmPassword}
                            autoComplete="new-password"
                        />
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className={cn(
                        'w-full h-12 rounded-xl font-semibold text-primary-foreground',
                        'bg-primary hover:bg-primary/90 active:scale-[0.98]',
                        'flex items-center justify-center gap-2',
                        'transition-all duration-150',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                        <>
                            {isRegistering ? 'Create Account' : 'Sign In'}
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </form>

            {/* Toggle */}
            <p className="text-center text-sm">
                <button type="button" onClick={toggleMode} disabled={isLoading} className="text-primary hover:text-primary/80 font-medium disabled:opacity-50">
                    {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
            </p>
        </div>
    );
};

// Simple input field component
interface InputFieldProps {
    icon: React.ReactNode;
    name: string;
    type?: string;
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    error?: string;
    autoComplete?: string;
    rightElement?: React.ReactNode;
}

const InputField: React.FC<InputFieldProps> = ({ icon, name, type = 'text', placeholder, value, onChange, disabled, error, autoComplete, rightElement }) => (
    <div>
        <div className={cn(
            'flex items-center h-12 rounded-xl border px-4 gap-3',
            'bg-card',
            'focus-within:ring-2 focus-within:ring-ring/30 focus-within:border-ring',
            error ? 'border-destructive' : 'border-input'
        )}>
            <span className="text-muted-foreground">{icon}</span>
            <input
                name={name}
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                disabled={disabled}
                autoComplete={autoComplete}
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
            />
            {rightElement}
        </div>
        {error && <p className="text-xs text-destructive mt-1 ml-1">{error}</p>}
    </div>
);

// Clean up error messages - auth-specific messages take priority, then shared utils
function cleanErrorMessage(error: string): string {
    const cleaned = cleanApiErrorMessage(error).toLowerCase();

    // Auth-specific messages
    if (cleaned.includes('invalid username or password') || cleaned.includes('invalid credentials')) {
        return 'Invalid username or password.';
    }
    if (cleaned.includes('username already exists')) {
        return 'Username already taken.';
    }

    // HTTP status errors (e.g., "HTTP 405", "HTTP 500")
    if (/http\s+[45]\d{2}/i.test(cleaned)) {
        return 'Server error. Please try again later.';
    }

    // Generic network/offline via shared util
    if (isNetworkError(error)) {
        if (cleaned.includes('offline') || cleaned.includes('available offline')) {
            return 'You\'re offline. Please connect to sign in.';
        }
        return 'Connection error. Please try again.';
    }

    // Return cleaned message or generic fallback
    return cleanApiErrorMessage(error) || 'Something went wrong.';
}
