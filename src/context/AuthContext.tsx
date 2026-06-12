import React, { createContext, useContext, useState, useEffect } from "react";
import {
  auth,
  db,
  isFirebaseConfigured,
  googleProvider,
  handleFirestoreError,
  OperationType
} from "../firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { UserDoc, UserRole } from "../types";
import { initFirestoreListeners } from "../dbStore";


interface AuthContextType {
  currentUser: FirebaseUser | null;
  profile: UserDoc | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  isFirebaseMode: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateUserRole: (role: UserRole, studentId?: string) => Promise<void>;
  simulateSignIn: (email: string, role: UserRole, displayName: string, studentId?: string) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFirebaseMode, setIsFirebaseMode] = useState(isFirebaseConfigured);

  // Check if we have localStorage mock profile
  useEffect(() => {
    if (!isFirebaseConfigured) {
      const stored = localStorage.getItem("classpulse_mock_auth");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setProfile(parsed);
          setRole(parsed.role);
          // Set loading to false once checked
        } catch (e) {
          console.error("Local mock parsing error:", e);
        }
      }
      setLoading(false);
    }
  }, []);

  // Listen to Auth State if Firebase is configured
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError(null);

      if (firebaseUser) {
        const email = firebaseUser.email;
        if (!email) {
          setError("Required: account must have an email address.");
          await signOut(auth);
          setCurrentUser(null);
          setProfile(null);
          setRole(null);
          setLoading(false);
          return;
        }

        // Strict: Only @au.edu allowed
        if (!email.toLowerCase().endsWith("@au.edu")) {
          setError("Only @au.edu accounts are allowed.");
          await signOut(auth);
          setCurrentUser(null);
          setProfile(null);
          setRole(null);
          setLoading(false);
          return;
        }

        setCurrentUser(firebaseUser);

        // Fetch or create user document in Firestore
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const loadedProfile: UserDoc = {
              uid: firebaseUser.uid,
              displayName: data.displayName || firebaseUser.displayName || "AU User",
              email: data.email || firebaseUser.email,
              role: data.role as UserRole,
              studentId: data.studentId,
              createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
            };
            
            // update lastLoginAt
            await updateDoc(userDocRef, {
              lastLoginAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });

            setProfile(loadedProfile);
            setRole(data.role as UserRole || null);
            // Trigger Firestore automatic synchronization
            initFirestoreListeners(firebaseUser.uid);
          } else {
            // First time login - create baseline profile (without role)
            const newUserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || "AU Academic",
              photoURL: firebaseUser.photoURL || "",
              role: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastLoginAt: serverTimestamp()
            };
            await setDoc(userDocRef, newUserData);

            const baselineProfile: UserDoc = {
              uid: firebaseUser.uid,
              displayName: newUserData.displayName,
              email: newUserData.email,
              role: null as any,
              createdAt: Date.now()
            };

            setProfile(baselineProfile);
            setRole(null);
            // Trigger Firestore automatic synchronization
            initFirestoreListeners(firebaseUser.uid);
          }
        } catch (err: any) {
          console.error("Error reading/writing Firestore user profile:", err);
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
          setError("Failed to synchronize user profile.");
        }
      } else {
        setCurrentUser(null);
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    if (!isFirebaseConfigured || !auth) {
      setError("Firebase is not configured yet. Please configure VITE_FIREBASE_ env variables in settings or simulate login below.");
      return;
    }
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Popup Error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-In popup was closed before completion.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Network connection issue. Please check your connectivity.");
      } else {
        setError(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    setError(null);
    setLoading(true);
    try {
      if (isFirebaseConfigured && auth) {
        await signOut(auth);
      } else {
        localStorage.removeItem("classpulse_mock_auth");
      }
      setCurrentUser(null);
      setProfile(null);
      setRole(null);
    } catch (err: any) {
      setError(err.message || "Failed to sign out.");
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (selectedRole: UserRole, studentId?: string) => {
    setError(null);
    if (!currentUser && !profile) {
      setError("No active user authenticated.");
      return;
    }

    setLoading(true);
    try {
      if (isFirebaseConfigured && db && currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const updateData: any = {
          role: selectedRole,
          updatedAt: serverTimestamp()
        };
        if (studentId) {
          updateData.studentId = studentId;
        }
        await updateDoc(userDocRef, updateData);

        setRole(selectedRole);
        if (profile) {
          setProfile({ ...profile, role: selectedRole, studentId });
        }
      } else {
        // Fallback mockup updates
        const updatedMock: UserDoc = {
          uid: profile?.uid || "mock-user-id",
          displayName: profile?.displayName || "Demo AU User",
          email: profile?.email || "demo@au.edu",
          role: selectedRole,
          studentId,
          createdAt: Date.now()
        };
        localStorage.setItem("classpulse_mock_auth", JSON.stringify(updatedMock));
        setProfile(updatedMock);
        setRole(selectedRole);
      }
    } catch (err: any) {
      console.error("Error setting role:", err);
      setError("Failed to save selected role.");
    } finally {
      setLoading(false);
    }
  };

  // Simulation handler for easy testing without Firebase configs
  const simulateSignIn = (email: string, selectedRole: UserRole, displayName: string, studentId?: string) => {
    setError(null);
    if (!email.toLowerCase().endsWith("@au.edu")) {
      setError("Only @au.edu accounts are allowed.");
      return;
    }
    const mockUser: UserDoc = {
      uid: "mock-" + Math.random().toString(36).substring(2, 9),
      displayName,
      email,
      role: selectedRole,
      studentId,
      createdAt: Date.now()
    };
    localStorage.setItem("classpulse_mock_auth", JSON.stringify(mockUser));
    setProfile(mockUser);
    setRole(selectedRole);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        role,
        loading,
        error,
        isFirebaseMode: isFirebaseConfigured,
        signInWithGoogle,
        signOutUser,
        updateUserRole,
        simulateSignIn,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
