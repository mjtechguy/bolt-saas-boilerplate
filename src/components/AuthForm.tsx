import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { LogIn, UserPlus, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import { useSiteSettings } from "../hooks/useSiteSettings";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { siteSettings } = useSiteSettings();
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [organizationID, setOrganizationID] = useState<string | null>(null);
  const [organizationAuthProvider, setOrganizationAuthProvider] = useState<
    any[] | null
  >([]);

  const getOrganizationAuth = async (orgId: string) => {
    const { data: org, error } = await supabase
      .from("organization_auth_settings")
      .select("client_id, client_secret, authorization_endpoint, token_endpoint, userinfo_endpoint, provider, name")
      .eq("organization_id", orgId);
    setOrganizationAuthProvider(org);

    if (error) {
      console.error("Error fetching organization auth settings:", error);
      return;
    }
  };

  const getDefaultOrganizationAuth = async () => {
    const { data: org, error } = await supabase
      .from("organization_auth_settings")
      .select("client_id, client_secret, authorization_endpoint, token_endpoint, userinfo_endpoint, provider, name")

    setOrganizationAuthProvider(org);

    if (error) {
      console.error("Error fetching organization auth settings:", error);
      return;
    }
  };
  console.log(organizationAuthProvider, "provider");
  // Set default admin credentials if they exist
  useEffect(() => {
    const defaultAdminEmail = import.meta.env.VITE_DEFAULT_ADMIN_EMAIL;
    const defaultAdminPassword = import.meta.env.VITE_DEFAULT_ADMIN_PASSWORD;

    if (defaultAdminEmail && defaultAdminPassword) {
      setEmail(defaultAdminEmail);
      setPassword(defaultAdminPassword);
    }
  }, [mode]);

  const handleSubmitAUthProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (organizations.length > 0) {
        const organization = organizations.find(
          (org) => org.name === orgName.trim()
        );

        if (!organization) {
          setError("Organization not found!");
          return;
        } else {
          setOrganizationID(organization.id);
          localStorage.setItem("organization_id", organization.id);
          getOrganizationAuth(organization.id);
        }
      } else {
        if (mode === "signup") {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                is_global_admin:
                  email === import.meta.env.VITE_DEFAULT_ADMIN_EMAIL,
              },
            },
          });

          if (signUpError) throw signUpError;

          setSuccess("Account created successfully! You can now log in.");
        } else {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) throw signInError;

          // Redirect to dashboard after successful login
          navigate("/admin/dashboard");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "signup") {
        const {error: signUpError} = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              is_global_admin:
                email === import.meta.env.VITE_DEFAULT_ADMIN_EMAIL,
            },
          },
        });

        if (signUpError) throw signUpError;

        setSuccess("Account created successfully! You can now log in.");
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        // Step 2: Fetch the user's profile to check if they are a global admin
        // const { data: { user }, error: userError } = await supabase.auth.getUser();

        // if (userError || !user) throw new Error("Failed to fetch user details.");

        // const { data: profile, error: profileError } = await supabase
        //   .from("profiles")
        //   .select("*")
        //   .eq("id", user.id)
        //   .single();

        // if (profileError) throw profileError;

        // const isGlobalAdmin = profile.is_global_admin;

        // if (!isGlobalAdmin) {
        //   // Step 3: For non-global admins, check if the user is part of the organization
        //   const organizationId = localStorage.getItem("organization_id");

        //   if (!organizationId) {
        //     throw new Error("Organization ID not found in localStorage.");
        //   }

        //   // Fetch the user's organizations from the user_organizations table
        //   const { data: userOrgs, error: orgError } = await supabase
        //     .from("user_organizations")
        //     .select("user_id, organization_id")
        //     .eq("user_id", user.id)
        //     .eq("organization_id", organizationId);

        //   if (orgError) throw orgError;

        //   // If the user is not part of the organization, throw an error
        //   if (!userOrgs || userOrgs.length === 0) {
        //     throw new Error("You are not part of this organization.");
        //   }
        // }

        // Step 4: Redirect to the dashboard after successful login
        navigate("/admin/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };
  // Get the appropriate logo based on theme
  const logoUrl =
    theme === "dark" ? siteSettings?.dark_logo_url : siteSettings?.logo_url;

  const loadOrganizations = async () => {
    try {
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url");

      if (error) throw error;

      setOrganizations(orgs);
    } catch (error) {
      console.error("Error loading organizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (authSettings: { provider: any; name: any; client_id: any; client_secret: any; authorization_endpoint: any; token_endpoint: any; userinfo_endpoint: any; }) => {
    try {
      const { provider, name, client_id, client_secret, authorization_endpoint, token_endpoint, userinfo_endpoint } = authSettings;
      console.log(authSettings, 'auth provider from settings')

      // Determine the provider type (OAuth or OpenID)
      const isOpenID = provider === 'openid';

      // Perform OAuth/OpenID login with the organization's credentials
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: isOpenID ? 'custom' : name.toLowerCase(), // Use 'custom' for OpenID
        options: {
          // redirectTo: 'https://yourapp.com/callback',
          scopes: 'email profile',
          queryParams: {
            client_id: client_id,
            // client_secret: client_secret,
          },
          endpoints: isOpenID ? {
            authorization: authorization_endpoint,
            token: token_endpoint,
            userInfo: userinfo_endpoint,
          } : undefined,
        },
      });

      if (authError) {
        throw authError;
      }

      console.log('Login successful:', data);
    } catch (error) {
      console.error('Error during login:', error.message);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);
  useEffect(() => {
    if (organizations.length === 1) {
      getDefaultOrganizationAuth();
    }
  }, [organizations]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center">
          {logoUrl ? (
            <img
              className="h-12 w-auto mb-8"
              src={logoUrl}
              alt={siteSettings?.site_name}
            />
          ) : (
            <span className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
              {siteSettings?.site_name || "My Application"}
            </span>
          )}
        </Link>
        <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          {mode === "login"
            ? "Sign in to your account"
            : "Create a new account"}
        </h2>
      </div>

      {organizations.length <=0|| organizationID ||  mode==='signup'||
        (organizationAuthProvider && organizationAuthProvider?.length > 0) ? (
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Email address
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-green-600 dark:text-green-400 text-sm">
                  {success}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : mode === "login" ? (
                    <>
                      <LogIn className="h-5 w-5 mr-2" />
                      Sign in
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-5 w-5 mr-2" />
                      Sign up
                    </>
                  )}
                </button>
              </div>

              <div className="text-sm text-center">
                {mode === "login" ? (
                  <p className="text-gray-600 dark:text-gray-400">
                    Don't have an account?{" "}
                    <Link
                      to="/signup"
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                    >
                      Sign up
                    </Link>
                  </p>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400">
                    Already have an account?{" "}
                    <Link
                      to="/login"
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                    >
                      Sign in
                    </Link>
                  </p>
                )}
              </div>
            </form>

            {organizationAuthProvider &&
              organizationAuthProvider.length > 0 && (
                <div className="mt-1">
                  <p className="w-full text-center my-2">OR</p>
                  {organizationAuthProvider?.map((authSettings: any) => {
                    return (
                      <>
                        <div key={authSettings.name} className="flex flex-col items-center">
                          <button className="bg-indigo-600 text-white py-2 px-4 rounded-lg"
                            onClick={() => handleLogin(authSettings)}
                          >
                            Sign in with {authSettings.name}
                          </button>
                        </div>
                      </>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      ) : (
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Enter Organization Name
                </label>
                <div className="mt-1">
                  <input
                    id="orgName"
                    name="orgName"
                    type="text"
                    placeholder="Organization Name"
                    // autoComplete="email"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-green-600 dark:text-green-400 text-sm">
                  {success}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  onClick={handleSubmitAUthProvider}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <>
                    <LogIn className="h-5 w-5 mr-2" />
                    Continue
                  </>
                </button>
              </div>
              <div className="text-sm text-center">
                {mode === "login" && (
                  <p className="text-gray-600 dark:text-gray-400">
                    Don't have an account?{" "}
                    <Link
                      to="/signup"
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                    >
                      Sign up
                    </Link>
                  </p>
                )}
                  </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
