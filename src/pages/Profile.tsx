import React, { useState, useEffect } from 'react';
import { User, Mail, Upload, Shield, QrCode, Lock } from 'lucide-react';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';
import type { OTPSetupResponse } from '../lib/types';

export function Profile() {
  const { profile, loading: profileLoading } = useProfile();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailChanged, setEmailChanged] = useState(false);
  const [showOTPSetup, setShowOTPSetup] = useState(false);
  const [otpSetup, setOTPSetup] = useState<OTPSetupResponse | null>(null);
  const [otpCode, setOTPCode] = useState('');
  const [form, setForm] = useState({
    display_name: profile?.display_name || '',
    email: profile?.email || '',
    avatar: null as File | null,
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // Reset form when profile changes
  useEffect(() => {
    if (profile) {
      setForm(prev => ({
        ...prev,
        display_name: profile.display_name || '',
        email: profile.email || ''
      }));
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      let avatarUrl = profile?.avatar_url;

      // Handle avatar upload
      if (form.avatar) {
        const fileExt = form.avatar.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('avatars')
          .upload(fileName, form.avatar);

        if (uploadError) throw uploadError;
        if (data) {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(data.path);
          avatarUrl = publicUrl;
        }
      }

      // Handle password change
      if (form.current_password && form.new_password) {
        if (form.new_password !== form.confirm_password) {
          throw new Error('New passwords do not match');
        }

        const { error: passwordError } = await supabase.auth.updateUser({
          password: form.new_password
        });

        if (passwordError) throw passwordError;
      }

      // Handle email change
      if (form.email !== profile?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: form.email
        });

        if (emailError) throw emailError;
        setEmailChanged(true);
      }

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: form.display_name,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      setMessage({ 
        type: 'success', 
        text: emailChanged 
          ? 'Profile updated successfully. Please check your email to confirm your new email address.'
          : 'Profile updated successfully'
      });

      // Reset password fields
      setForm(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }));
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to update profile' 
      });
    } finally {
      setLoading(false);
    }
  };

  const setupOTP = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.mfa.enroll();
      
      if (error) throw error;
      
      setOTPSetup({
        qr_code: data.qr_code,
        secret: data.secret
      });
      setShowOTPSetup(true);
    } catch (error) {
      console.error('Error setting up OTP:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to set up OTP'
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.mfa.verify({
        code: otpCode,
        factorId: otpSetup?.secret || ''
      });

      if (error) throw error;

      // Update profile to indicate OTP is enabled
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ has_otp_enabled: true })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      setMessage({
        type: 'success',
        text: 'Two-factor authentication enabled successfully'
      });
      setShowOTPSetup(false);
      setOTPSetup(null);
      setOTPCode('');
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to verify OTP code'
      });
    } finally {
      setLoading(false);
    }
  };

  const disableOTP = async () => {
    if (!window.confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.mfa.unenroll();

      if (error) throw error;

      // Update profile to indicate OTP is disabled
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ has_otp_enabled: false })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      setMessage({
        type: 'success',
        text: 'Two-factor authentication disabled successfully'
      });
    } catch (error) {
      console.error('Error disabling OTP:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to disable OTP'
      });
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <User className="h-6 w-6 mr-2" />
          Profile Settings
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Profile Picture
            </label>
            <div className="mt-2 flex items-center space-x-4">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || profile?.email || '')}&background=random`}
                  alt="Profile"
                  className="h-16 w-16 rounded-full"
                />
              )}
              <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <Upload className="h-5 w-5 mr-2" />
                Change Picture
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => setForm({ ...form, avatar: e.target.files?.[0] || null })}
                />
              </label>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Display Name
            </label>
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email Address
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>

          {/* Password Change */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <Lock className="h-5 w-5 mr-2" />
              Change Password
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current Password
                </label>
                <input
                  type="password"
                  value={form.current_password}
                  onChange={(e) => setForm({ ...form, current_password: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  New Password
                </label>
                <input
                  type="password"
                  value={form.new_password}
                  onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Two-Factor Authentication Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Two-Factor Authentication
            </h3>
            
            {!profile?.has_otp_enabled && !showOTPSetup && (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-md mb-4">
                <p className="text-sm text-yellow-700 dark:text-yellow-200">
                  Two-factor authentication is not enabled. Enable it to add an extra layer of security to your account.
                </p>
                <button
                  type="button"
                  onClick={setupOTP}
                  disabled={loading}
                  className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  <QrCode className="h-5 w-5 mr-2" />
                  Set Up Two-Factor Authentication
                </button>
              </div>
            )}

            {showOTPSetup && otpSetup && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    1. Scan QR Code
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Scan this QR code with your authenticator app (e.g., Google Authenticator, Authy)
                  </p>
                  <div className="bg-white p-4 rounded-md inline-block">
                    <img
                      src={otpSetup.qr_code}
                      alt="QR Code for OTP Setup"
                      className="w-48 h-48"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    2. Enter Verification Code
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Enter the 6-digit code from your authenticator app
                  </p>
                  <div className="flex items-center space-x-4">
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOTPCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center text-2xl tracking-widest"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={verifyOTP}
                      disabled={loading || otpCode.length !== 6}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      Verify Code
                    </button>
                  </div>
                </div>
              </div>
            )}

            {profile?.has_otp_enabled && (
              <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-md">
                <p className="text-sm text-green-700 dark:text-green-200">
                  Two-factor authentication is enabled. Your account is more secure.
                </p>
                <button
                  type="button"
                  onClick={disableOTP}
                  disabled={loading}
                  className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Disable Two-Factor Authentication
                </button>
              </div>
            )}
          </div>

          {message && (
            <div className={`rounded-md p-4 ${
              message.type === 'success' 
                ? 'bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-200' 
                : 'bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200'
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex justify-end pt-6">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}