import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const FamilyContext = createContext();

export function FamilyProvider({ children }) {
  const { token, user, isDemoMode } = useAuth();
  const [familyMembers, setFamilyMembers] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFamilyMembers = useCallback(async () => {
    const authToken = token || localStorage.getItem('healthgpt_token');
    if (!authToken && !isDemoMode) {
      setFamilyMembers([]);
      setActiveProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/family', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (res.ok) {
        const members = (data.familyMembers || []).map(m => ({
          ...m,
          full_name: m.name || m.full_name,
          relationship: m.relation || m.relationship || m.profile_type,
          dob: m.date_of_birth || m.dob
        }));
        setFamilyMembers(members);

        // Determine active profile from localStorage or default to self
        const savedId = localStorage.getItem('vitacare_active_profile_id');
        let current = members.find(m => m.id === savedId);
        if (!current && members.length > 0) {
          current = members.find(m => m.profile_type === 'self') || members[0];
        }

        setActiveProfile(current || null);
        if (current) {
          localStorage.setItem('vitacare_active_profile_id', current.id);
        }
      } else {
        // Fallback default self profile
        const defaultSelf = {
          id: user?.id ? `self-${user.id}` : 'fam-a-self',
          name: user?.full_name || 'Alex Rivera',
          relation: 'self',
          profile_type: 'self',
          blood_group: 'O+',
          allergies: 'Penicillin',
          conditions: 'Prediabetes'
        };
        setFamilyMembers([defaultSelf]);
        setActiveProfile(defaultSelf);
      }
    } catch (err) {
      console.warn('Family members fetch error:', err);
      const defaultSelf = {
        id: 'fam-a-self',
        name: user?.full_name || 'Alex Rivera',
        relation: 'self',
        profile_type: 'self',
        blood_group: 'O+'
      };
      setFamilyMembers([defaultSelf]);
      setActiveProfile(defaultSelf);
    } finally {
      setLoading(false);
    }
  }, [token, user, isDemoMode]);

  useEffect(() => {
    fetchFamilyMembers();
  }, [fetchFamilyMembers]);

  const switchProfile = (profileId) => {
    const target = familyMembers.find(m => m.id === profileId);
    if (target) {
      setActiveProfile(target);
      localStorage.setItem('vitacare_active_profile_id', target.id);
      // Dispatch custom event to notify components that active health profile changed
      window.dispatchEvent(new CustomEvent('vitacare:profile-changed', { detail: target }));
    }
  };

  const addFamilyMember = async (memberData) => {
    const authToken = token || localStorage.getItem('healthgpt_token');
    const res = await fetch('/api/family', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(memberData)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create family profile');
    }

    const data = await res.json();
    await fetchFamilyMembers();
    return data.member;
  };

  const revokeFamilyMember = async (memberId) => {
    const authToken = token || localStorage.getItem('healthgpt_token');
    const res = await fetch(`/api/family/${memberId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to revoke profile access');
    }

    await fetchFamilyMembers();
  };

  return (
    <FamilyContext.Provider
      value={{
        familyMembers,
        activeProfile,
        loading,
        error,
        switchProfile,
        addFamilyMember,
        revokeFamilyMember,
        refreshFamilyMembers: fetchFamilyMembers
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export const useFamily = () => useContext(FamilyContext);
