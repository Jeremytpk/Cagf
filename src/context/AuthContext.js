import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { bootstrapAdmin } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setIsAdmin(false);
        setInitializing(false);
        return;
      }
      try {
        const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
        setUser(firebaseUser);
        setIsAdmin(adminDoc.exists());
      } catch (error) {
        setUser(firebaseUser);
        setIsAdmin(false);
      } finally {
        setInitializing(false);
      }
    });
    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const adminDoc = await getDoc(doc(db, 'admins', credential.user.uid));
    if (!adminDoc.exists()) {
      await signOut(auth);
      throw new Error("Ce compte n'a pas les droits administrateur.");
    }
    return credential.user;
  };

  // Crée un compte administrateur. Le serveur (bootstrapAdmin) n'accorde les
  // droits que si aucun admin n'existe déjà — sinon le compte Auth qui vient
  // d'être créé est supprimé côté serveur et on se déconnecte localement.
  const signup = async (email, password) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    try {
      const idToken = await credential.user.getIdToken();
      await bootstrapAdmin({ idToken });
      setUser(credential.user);
      setIsAdmin(true);
      return credential.user;
    } catch (error) {
      await signOut(auth);
      throw new Error(error.message || 'Impossible de créer le compte administrateur.');
    }
  };

  const logout = () => signOut(auth);

  const getIdToken = async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, initializing, login, signup, logout, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé à l\'intérieur de AuthProvider');
  return context;
}
