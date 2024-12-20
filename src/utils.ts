export const splitAt = (index: number, xs: string) => [xs.slice(0, index), xs.slice(index)]

const possibleImageAngles = [-0.07, -0.06, -0.05, 0.05, 0.06, 0.07]

export const randomImageAngle = () => {
  return possibleImageAngles[Math.floor(Math.random() * possibleImageAngles.length)]
}
