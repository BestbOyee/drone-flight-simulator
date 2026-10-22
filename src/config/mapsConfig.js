export const MAPS = [
    {
      id: 'park',
      name: 'Verdant Park',
      skyColor: '#87ceeb',
      fogColor: '#87ceeb',
      groundColor: '#2e7d32',
      ambientLight: 1.2,
      dirLightColor: '#ffffff',
      hasTrees: true,
      particleType: 'snow', // Snow is enabled ONLY here
      description: 'Lush green fields with gentle snowfall and obstacle rings.'
    },
    {
      id: 'cyber',
      name: 'Neon Cyber City',
      skyColor: '#090d16',
      fogColor: '#090d16',
      groundColor: '#1e1b4b',
      ambientLight: 0.8,
      dirLightColor: '#38bdf8',
      hasTrees: false,
      particleType: 'none', // No snow
      description: 'Futuristic night skyline with glowing neon structures.'
    },
    {
      id: 'desert',
      name: 'Canyon Desert',
      skyColor: '#fed7aa',
      fogColor: '#fed7aa',
      groundColor: '#b45309',
      ambientLight: 1.5,
      dirLightColor: '#fef08a',
      hasTrees: false,
      particleType: 'none', // No snow
      description: 'Sandy mesas and warm thermal updrafts.'
    }
  ];