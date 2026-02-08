'use client'
import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'
import openapi from "./openapi.json";

export default function References() {
  return (
    <ApiReferenceReact
      configuration={{
        content:openapi
      }}
    />
  )
}