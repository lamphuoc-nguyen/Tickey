export function safeReturnPath(path: string | undefined): string {
  if (
    !path ||
    !/^\/(?:$|staff(?:[/?]|$)|orders(?:[/?]|$)|profile(?:[/?]|$)|booking\/[\w-]+(?:[/?]|$)|sessions\/[\w-]+\/select(?:[?]|$)|tickets(?:[/?]|$)|refunds(?:[/?]|$)|notifications(?:[/?]|$)|support(?:[/?]|$)|reports(?:[/?]|$))/.test(
      path,
    ) ||
    path.includes('..')
  )
    return '/';
  return path;
}
