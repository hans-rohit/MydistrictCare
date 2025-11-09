import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Center, Spinner } from '@chakra-ui/react'

export default function PrivateRoute({ requireRole, requireDept }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <Center py={20}>
        <Spinner />
      </Center>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (requireRole) {
    if (requireRole === 'admin' && profile?.role !== 'admin') {
      return <Navigate to="/" replace />
    }
    if (requireRole === 'dept') {
      if (profile?.role !== 'dept' && profile?.role !== 'admin') {
        return <Navigate to="/" replace />
      }
      if (requireDept && profile?.role === 'dept' && profile?.department !== requireDept) {
        return <Navigate to="/" replace />
      }
    }
  }

  return <Outlet />
}