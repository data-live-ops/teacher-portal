import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.mjs';

const norm = (value) => (value ?? '').toString().trim().toLowerCase();

// Key used to match a piket_schedule (grade, subject) pair against a mapping rule.
export const pairKey = (grade, subject) => `${norm(grade)}|||${norm(subject)}`;

/**
 * Loads the Piket navigation config (groups + grade/subject mappings).
 * If the tables are missing or empty the page falls back to showing
 * piket_schedule.grade / subject as-is, so this never blocks the schedule.
 */
const usePiketNavConfig = () => {
    const [groups, setGroups] = useState([]);
    const [mappings, setMappings] = useState([]);

    const reload = useCallback(async () => {
        try {
            const [groupsRes, mappingsRes] = await Promise.all([
                supabase.from('piket_nav_groups').select('*').order('position'),
                supabase.from('piket_group_mappings').select('*').order('position'),
            ]);
            if (groupsRes.error) throw groupsRes.error;
            if (mappingsRes.error) throw mappingsRes.error;

            setGroups(groupsRes.data || []);
            setMappings(mappingsRes.data || []);
        } catch (error) {
            console.error('Error fetching piket nav config:', error);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const save = useCallback(async (nextGroups, nextMappings, userEmail) => {
        const { error } = await supabase.rpc('save_piket_nav_config', {
            p_groups: nextGroups.map((g, index) => ({ ...g, position: index })),
            p_mappings: nextMappings.map((m, index) => ({ ...m, position: index })),
            p_user: userEmail || null,
        });
        if (error) throw error;
        await reload();
    }, [reload]);

    return { groups, mappings, reload, save };
};

export default usePiketNavConfig;
