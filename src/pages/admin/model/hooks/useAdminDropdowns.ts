import { useState, useRef, useEffect } from 'react'

type MenuPos = { top: number; left: number; width: number }

export function useAdminDropdowns() {
  const [openRoleDropdown, setOpenRoleDropdown] = useState<number | null>(null)
  const [roleMenuPos, setRoleMenuPos] = useState<MenuPos | null>(null)
  const roleDropdownRef = useRef<HTMLDivElement | null>(null)

  const [openTTDropdown, setOpenTTDropdown] = useState<number | null>(null)
  const [ttMenuPos, setTTMenuPos] = useState<MenuPos | null>(null)
  const ttDropdownRef = useRef<HTMLDivElement | null>(null)

  const [openPosDropdown, setOpenPosDropdown] = useState<number | null>(null)
  const [posMenuPos, setPosMenuPos] = useState<MenuPos | null>(null)
  const posDropdownRef = useRef<HTMLDivElement | null>(null)

  const closePosDropdown = () => {
    setOpenPosDropdown(null)
    setPosMenuPos(null)
  }

  useEffect(() => {
    if (openRoleDropdown === null) return
    const handleClick = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setOpenRoleDropdown(null)
        setRoleMenuPos(null)
      }
    }
    const handleScroll = () => {
      setOpenRoleDropdown(null)
      setRoleMenuPos(null)
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [openRoleDropdown])

  useEffect(() => {
    if (openTTDropdown === null) return
    const handleClick = (e: MouseEvent) => {
      if (ttDropdownRef.current && !ttDropdownRef.current.contains(e.target as Node)) {
        setOpenTTDropdown(null)
        setTTMenuPos(null)
      }
    }
    const handleScroll = () => {
      setOpenTTDropdown(null)
      setTTMenuPos(null)
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [openTTDropdown])

  useEffect(() => {
    if (openPosDropdown === null) return
    const handleClick = (e: MouseEvent) => {
      if (posDropdownRef.current && !posDropdownRef.current.contains(e.target as Node)) {
        setOpenPosDropdown(null)
        setPosMenuPos(null)
      }
    }
    const handleScroll = () => {
      setOpenPosDropdown(null)
      setPosMenuPos(null)
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [openPosDropdown])

  return {
    openRoleDropdown,
    setOpenRoleDropdown,
    roleMenuPos,
    setRoleMenuPos,
    roleDropdownRef,
    openTTDropdown,
    setOpenTTDropdown,
    ttMenuPos,
    setTTMenuPos,
    ttDropdownRef,
    openPosDropdown,
    setOpenPosDropdown,
    posMenuPos,
    setPosMenuPos,
    posDropdownRef,
    closePosDropdown,
  }
}
