import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.mjs';


export const useTeacherAssignmentValidation = () => {
  const [validationState, setValidationState] = useState({
    isValidating: false,
    errors: [],
    warnings: [],
    isValid: null,
    expectedTeacher: null,
    matchedSessions: 0,
  });


  const validateAssignment = useCallback(async (assignmentData) => {
    const {
      id: assignmentId = null,
      grade,
      slot_name,
      days,
      time_range,
      guru_juara_id,
      status,
      class_rule,
    } = assignmentData;

    setValidationState({
      isValidating: true,
      errors: [],
      warnings: [],
      isValid: null,
      expectedTeacher: null,
      matchedSessions: 0,
    });

    try {
      const { data, error } = await supabase.rpc(
        'validate_teacher_assignment_for_frontend',
        {
          p_assignment_id: assignmentId,
          p_grade: grade,
          p_slot_name: slot_name,
          p_days: days,
          p_time_range: time_range,
          p_guru_juara_id: guru_juara_id,
          p_status: status,
          p_class_rule: class_rule,
        }
      );

      if (error) {
        console.error('Validation error:', error);
        setValidationState({
          isValidating: false,
          errors: [error.message],
          warnings: [],
          isValid: false,
          expectedTeacher: null,
          matchedSessions: 0,
        });
        return {
          success: false,
          errors: [error.message],
        };
      }

      const result = data;

      setValidationState({
        isValidating: false,
        errors: result.errors || [],
        warnings: result.warnings || [],
        isValid: result.success,
        expectedTeacher: result.expected_teacher,
        matchedSessions: result.matched_sessions || 0,
        isMandatory: result.is_mandatory,
      });

      return result;
    } catch (err) {
      console.error('Validation exception:', err);
      setValidationState({
        isValidating: false,
        errors: [err.message],
        warnings: [],
        isValid: false,
        expectedTeacher: null,
        matchedSessions: 0,
      });
      return {
        success: false,
        errors: [err.message],
      };
    }
  }, []);

  const getExpectedTeacher = useCallback(async (slotConfig) => {
    const { grade, slot_name, days, time_range } = slotConfig;

    try {
      const { data, error } = await supabase.rpc(
        'get_expected_teacher_for_slot',
        {
          p_grade: grade,
          p_slot_name: slot_name,
          p_days: days,
          p_time_range: time_range,
        }
      );

      if (error) {
        console.error('Error getting expected teacher:', error);
        return { found: false, teachers_by_day: [] };
      }

      return data;
    } catch (err) {
      console.error('Exception getting expected teacher:', err);
      return { found: false, teachers_by_day: [] };
    }
  }, []);

  const checkSlotExists = useCallback(async (slotConfig) => {
    const { grade, slot_name, days, time_range } = slotConfig;

    try {
      const { data, error } = await supabase.rpc(
        'check_slot_exists_in_raw_sessions',
        {
          p_grade: grade,
          p_slot_name: slot_name,
          p_days: days,
          p_time_range: time_range,
        }
      );

      if (error) {
        console.error('Error checking slot existence:', error);
        return { exists: false, total_sessions: 0 };
      }

      return data;
    } catch (err) {
      console.error('Exception checking slot existence:', err);
      return { exists: false, total_sessions: 0 };
    }
  }, []);

  const resetValidation = useCallback(() => {
    setValidationState({
      isValidating: false,
      errors: [],
      warnings: [],
      isValid: null,
      expectedTeacher: null,
      matchedSessions: 0,
    });
  }, []);

  return {
    validationState,
    validateAssignment,
    getExpectedTeacher,
    checkSlotExists,
    resetValidation,
  };
};


export const formatValidationErrors = (errors) => {
  if (!errors || errors.length === 0) return null;

  return (
    <div className="validation-errors">
      <div className="font-bold text-red-600 mb-2">⚠️ Validation Errors:</div>
      <ul className="list-disc list-inside space-y-1">
        {errors.map((error, index) => (
          <li key={index} className="text-red-600 text-sm">
            {error}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const formatValidationWarnings = (warnings) => {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="validation-warnings">
      <div className="font-bold text-yellow-600 mb-2">⚡ Warnings:</div>
      <ul className="list-disc list-inside space-y-1">
        {warnings.map((warning, index) => (
          <li key={index} className="text-yellow-600 text-sm">
            {warning}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default useTeacherAssignmentValidation;
