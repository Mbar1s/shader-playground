"use client"
import React, { useState } from 'react'
import Space from '../Shaders/Space'
import ParticleSphere from '../Shaders/Sphere'
import Blob from '../Shaders/Blob'
import GlitchGradient from '../Shaders/GlitchGradient'
import WaveGlitchGradient from '../Shaders/WaveGlitch'
import ShapeMorph from '../Shaders/ShapeMorph'
import Lavalamp from '../Shaders/Lavalamp'
import WaveLine from '../Shaders/WaveLine'
import Glass from '../Shaders/Glass'
import Fluids from '../Shaders/Fluids'
import Rainbow from '../Shaders/Rainbow'
import Explosion from '../Shaders/Explosion'
type Props = Record<string, never>

function MainPage({}: Props) {
  const [activeShader, setActiveShader] = useState<string>('ParticleSphere')

  // Map of shader names to their components
  const shaderComponents: { [key: string]: React.ReactNode } = {
    ParticleSphere: <ParticleSphere />,
    Space: <Space />,
    Blob: <Blob />,
    GlitchGradient: <GlitchGradient />,
    WaveGlitchGradient: <WaveGlitchGradient />,
    ShapeMorph: <ShapeMorph />,
    Lavalamp: <Lavalamp />,
    WaveLine: <WaveLine />,
    Glass: <Glass />,
    Fluids: <Fluids />,
    Rainbow: <Rainbow />,
    Explosion: <Explosion />,
  }

  return (
    <div className='flex flex-col min-h-screen'>
      {/* Navigation Panel */}
      <div className='fixed top-0 left-0 z-10 p-4 bg-black/70 backdrop-blur-md rounded-br-lg'>
        <h1 className='text-xl font-bold text-white mb-4'>Shader Playground</h1>
        <div className='flex flex-col space-y-2'>
          {Object.keys(shaderComponents).map((shaderName) => (
            <button
              key={shaderName}
              className={`px-4 py-2 rounded transition-all ${
                activeShader === shaderName 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => setActiveShader(shaderName)}
            >
              {shaderName}
            </button>
          ))}
        </div>
      </div>

      {/* Shader Display Area */}
      <div className='w-full h-screen'>
        {shaderComponents[activeShader]}
      </div>
    </div>
  )
}

export default MainPage