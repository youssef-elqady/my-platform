import React from 'react';
import { useParams } from 'react-router-dom';
import StudentProfilePage from './StudentProfilePage';
import StudentVideoAnalytics from '../components/student/StudentVideoAnalytics';

export default function StudentProfileWithAnalytics(): React.ReactElement {
  const { studentId } = useParams<{ studentId: string }>();
  return <><StudentProfilePage />{studentId ? <StudentVideoAnalytics studentId={studentId} /> : null}</>;
}
