import { JWT } from 'google-auth-library'

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

/**
 * Konto serwisowe zamiast OAuth (D2): token nie wygasa po 7 dniach i nie
 * wymaga weryfikacji aplikacji u Google. Adres e-mail konta musi byc dodany
 * jako uzytkownik property w Search Console.
 */
export function createServiceAccountTokenSource(keyFilePath: string): () => Promise<string> {
  const client = new JWT({ keyFile: keyFilePath, scopes: [GSC_SCOPE] })
  return async () => {
    const { token } = await client.getAccessToken()
    if (!token) throw new Error(`Nie udalo sie uzyskac tokenu z klucza ${keyFilePath}`)
    return token
  }
}
