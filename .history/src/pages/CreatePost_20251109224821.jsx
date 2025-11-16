import { useEffect, useState, useRef, useMemo } from 'react'
import {
  Box, Button, Container, FormControl, FormLabel, Input, Select, Textarea,
  VStack, Progress, Alert, AlertIcon, HStack, Text, Link, useToast
} from '@chakra-ui/react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { getCurrentPosition, googleMapsLink } from '../lib/location'

const DEPARTMENTS = ['Electricity', 'Water', 'Sewage', 'Road']

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const CLOUDINARY_FOLDER = import.meta.env.VITE_CLOUDINARY_FOLDER || 'district-care/images'

export default function CreatePost() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [departmentTag, setDepartmentTag] = useState(DEPARTMENTS[0])
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [locStatus, setLocStatus] = useState('')
  const fileInputRef = useRef(null)

  // Check if all required fields are filled
  const isFormValid = useMemo(() => {
    return (
      title.trim() !== '' &&
      description.trim() !== '' &&
      departmentTag !== '' &&
      lat !== '' &&
      lng !== ''
    )
  }, [title, description, departmentTag, lat, lng])

  useEffect(() => {
    getCurrentPosition().then(({ lat, lng }) => {
      setLat(lat)
      setLng(lng)
      setLocStatus('Location detected from browser')
    }).catch(() => {
      setLocStatus('Could not auto-detect location. Enter manually or use the button below.')
    })
  }, [])

  const mapsUrl = googleMapsLink(lat, lng)

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0]
    if (f) {
      setError(null)
      setProgress(0)
      setFile(f)
      e.target.value = ''
    }
  }

  const handleClearFile = () => {
    setFile(null)
    setProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleUseMyLocation = async () => {
    try {
      const pos = await getCurrentPosition()
      setLat(pos.lat)
      setLng(pos.lng)
      setLocStatus('Location refreshed from browser')
    } catch {
      setLocStatus('Unable to fetch location. Check permissions/GPS.')
    }
  }

  // Upload to Cloudinary using XHR to track progress
  const uploadImage = () => {
    if (!file) return Promise.resolve({ imageURL: '', imageStoragePath: '' })
    return new Promise((resolve, reject) => {
      const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`

      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
      formData.append('folder', `${CLOUDINARY_FOLDER}/${user.uid}`)
      formData.append('context', `uid=${user.uid}|email=${user.email}`)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      xhr.upload.addEventListener('progress', (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100)
          setProgress(pct)
        }
      })
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText)
              resolve({ imageURL: res.secure_url, imageStoragePath: res.public_id })
            } catch (e) {
              reject(e)
            }
          } else {
            try {
              const res = JSON.parse(xhr.responseText)
              reject(new Error(res.error?.message || `Cloudinary upload failed (status ${xhr.status})`))
            } catch {
              reject(new Error(`Cloudinary upload failed (status ${xhr.status}): ${xhr.responseText || 'No response'}`))
            }
          }
        }
      }
      xhr.onerror = () => reject(new Error('Network error during Cloudinary upload'))
      xhr.send(formData)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { imageURL, imageStoragePath } = await uploadImage()
      const titleLower = (title || '').trim().toLowerCase()
      const titleSubstrings = buildTitleSubstrings(titleLower)
      const payload = {
        title,
        description,
        departmentTag,
        lat: Number(lat),
        lng: Number(lng),
        imageURL,                // Cloudinary secure URL
        imageStoragePath,        // Cloudinary public_id (for future delete/transform)
        status: 'pending',
        createdAt: serverTimestamp(),
        createdBy: {
          uid: user.uid,
          name: profile?.name || '',
          email: profile?.email || user.email
        },
        actionNote: '',
        titleLower,
        titleSubstrings
      }
      await addDoc(collection(db, 'posts'), payload)
      setTitle('')
      setDescription('')
      setFile(null)
      setProgress(0)
      toast({
        title: 'Successfully reported',
        description: 'Your report has been submitted successfully.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      })
    } catch (err) {
      setError(err.message)
      toast({
        title: 'Failed to submit report',
        description: err.message || 'An error occurred while submitting your report.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Build all unique substrings (length 2..30) of the title for Firestore contains-like search
  const buildTitleSubstrings = (t) => {
    const s = (t || '').trim()
    if (!s) return []
    const minLen = 2
    const maxLen = 30
    const set = new Set()
    for (let i = 0; i < s.length; i++) {
      for (let j = i + minLen; j <= Math.min(s.length, i + maxLen); j++) {
        set.add(s.slice(i, j))
      }
    }
    // Also include the full string if shorter than minLen
    if (s.length < minLen) set.add(s)
    return Array.from(set)
  }

  return (
    <Container maxW="container.sm" pb={12}>
      {error && <Alert status="error" mb={4}><AlertIcon />{error}</Alert>}
      <Box as="form" onSubmit={handleSubmit}>
        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel>Title</FormLabel>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Description</FormLabel>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Department</FormLabel>
            <Select value={departmentTag} onChange={(e) => setDepartmentTag(e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel>Image (camera or file)</FormLabel>
            <HStack spacing={2}>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                display="none"
              />
              <Input
                readOnly
                value={file ? file.name : 'No file chosen'}
                placeholder="No file chosen"
                flex={1}
              />
              <Button
                onClick={handleUploadClick}
                isDisabled={!!file}
                colorScheme="blue"
              >
                Upload
              </Button>
              <Button
                onClick={handleClearFile}
                isDisabled={!file}
                colorScheme="red"
                variant="outline"
              >
                Clear
              </Button>
            </HStack>
            {progress > 0 && <Progress value={progress} mt={2} />}
          </FormControl>
          <HStack align="start">
            <FormControl isRequired>
              <FormLabel>Latitude</FormLabel>
              <Input type="number" step="0.000001" value={lat} onChange={(e) => setLat(e.target.value)} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Longitude</FormLabel>
              <Input type="number" step="0.000001" value={lng} onChange={(e) => setLng(e.target.value)} />
            </FormControl>
          </HStack>
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.600">{locStatus}</Text>
            <Button size="sm" onClick={handleUseMyLocation} variant="outline">Use my location</Button>
          </HStack>
          {lat && lng && (
            <Text fontSize="sm">
              Location preview: <Link href={mapsUrl} isExternal color="blue.500">Open in Maps</Link>
            </Text>
          )}
          <Button type="submit" colorScheme="blue" isLoading={submitting} isDisabled={!isFormValid}>Submit</Button>
        </VStack>
      </Box>
    </Container>
  )
}