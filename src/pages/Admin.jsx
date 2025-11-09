import { useRef, useState } from 'react'
import { collection, doc, getDocs, query, updateDoc, where, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import {
  Container, Heading, VStack, FormControl, FormLabel, Input, Select, Button,
  Alert, AlertIcon, useToast, Text, Divider
} from '@chakra-ui/react'
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut as signOutSec } from 'firebase/auth'

const DEPARTMENTS = ['Electricity', 'Water', 'Sewage', 'Road']

// Build firebase config from env to init a secondary app (isolated Auth session)
const secondaryConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

export default function Admin() {
  // Create Department User state
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newDepartment, setNewDepartment] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  // Assign Role state (existing section)
  const [email, setEmail] = useState('')
  const [uid, setUid] = useState('')
  const [role, setRole] = useState('public')
  const [department, setDepartment] = useState('')
  const [error, setError] = useState(null)

  const toast = useToast()
  const secondaryAuthRef = useRef(null)

  const getSecondaryAuth = () => {
    if (!secondaryAuthRef.current) {
      // Use a named app so it doesn't collide with default
      const app = initializeApp(secondaryConfig, 'Secondary')
      secondaryAuthRef.current = getAuth(app)
    }
    return secondaryAuthRef.current
  }

  const handleCreateDeptUser = async () => {
    setCreateError(null)
    if (!newName || !newEmail || !newPassword || !newDepartment) {
      setCreateError('All fields are required')
      return
    }
    setCreating(true)
    try {
      const secAuth = getSecondaryAuth()
      const cred = await createUserWithEmailAndPassword(secAuth, newEmail.trim(), newPassword)
      await updateProfile(cred.user, { displayName: newName })
      // Write user profile in Firestore
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          name: newName,
          email: newEmail.trim(),
          role: 'dept',
          department: newDepartment,
          createdAt: serverTimestamp()
        }, { merge: true })
      } catch (fireErr) {
        // If Firestore rules block admin creating the doc, inform the admin
        console.error(fireErr)
        setCreateError('User created in Auth, but failed to write Firestore profile. Update rules or add the doc manually.')
      }
      // Sign out the secondary auth so we stay as the admin in the main app
      await signOutSec(secAuth)
      toast({ title: 'Department user created', status: 'success' })
      setNewName('')
      setNewEmail('')
      setNewPassword('')
      setNewDepartment('')
    } catch (err) {
      // Common: auth/email-already-in-use
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  // Existing: resolve uid by email (for role assignment)
  const resolveUid = async () => {
    if (uid) return uid
    if (!email) return null
    const qUsers = query(collection(db, 'users'), where('email', '==', email))
    const snap = await getDocs(qUsers)
    if (!snap.empty) return snap.docs[0].id
    return null
  }

  const handleAssign = async () => {
    setError(null)
    try {
      const targetUid = await resolveUid()
      if (!targetUid) {
        setError('User not found. Ensure they signed up or were created. You can also paste UID directly.')
        return
      }
      const ref = doc(db, 'users', targetUid)
      await setDoc(ref, {
        role,
        department: role === 'dept' ? department : null
      }, { merge: true })
      toast({ title: 'Role updated', status: 'success' })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Container maxW="container.sm" pb={12}>
      <Heading size="md" mb={4}>Admin</Heading>

      {/* Create Department User */}
      {createError && <Alert status="error" mb={4}><AlertIcon />{createError}</Alert>}
      <VStack align="stretch" spacing={4} mb={6} borderWidth="1px" borderRadius="md" p={4} bg="white">
        <Heading size="sm">Create Department User</Heading>
        <FormControl isRequired>
          <FormLabel>Name</FormLabel>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
        </FormControl>
        <FormControl isRequired>
          <FormLabel>Email</FormLabel>
          <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com" />
        </FormControl>
        <FormControl isRequired>
          <FormLabel>Password</FormLabel>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
        </FormControl>
        <FormControl isRequired>
          <FormLabel>Department</FormLabel>
          <Select value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)}>
            <option value="">Select department</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </FormControl>
        <Button colorScheme="blue" onClick={handleCreateDeptUser} isLoading={creating}>
          Create Department User
        </Button>
      </VStack>

      <Divider my={6} />

      {/* Assign Roles (existing)
      {error && <Alert status="error" mb={4}><AlertIcon />{error}</Alert>}
      <VStack align="stretch" spacing={4} borderWidth="1px" borderRadius="md" p={4} bg="white">
        <Heading size="sm">Assign Roles</Heading>
        <FormControl>
          <FormLabel>User Email (or leave blank and paste UID)</FormLabel>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormControl>
        <FormControl>
          <FormLabel>User UID (optional)</FormLabel>
          <Input value={uid} onChange={(e) => setUid(e.target.value)} />
        </FormControl>
        <FormControl>
          <FormLabel>Role</FormLabel>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="public">public</option>
            <option value="dept">dept</option>
            <option value="admin">admin</option>
          </Select>
        </FormControl>
        {role === 'dept' && (
          <FormControl isRequired>
            <FormLabel>Department</FormLabel>
            <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">Select department</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </FormControl>
        )}
        <Button colorScheme="blue" onClick={handleAssign}>Save</Button>
      </VStack> */}
    </Container>
  )
}