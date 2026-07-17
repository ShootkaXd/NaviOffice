import { useEffect, useState } from 'react';
import { fetchPhoto } from '../api';
import { initials } from '../utils';

/** Фото сотрудника как object URL (эндпоинт требует JWT — обычный img src не подходит). */
export function usePhoto(login: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!login) {
      setUrl(null);
      return;
    }
    let alive = true;
    fetchPhoto(login).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [login]);

  return url;
}

interface AvatarProps {
  login: string;
  name: string;
  size?: number;
  className?: string;
}

export default function Avatar({ login, name, size = 32, className = '' }: AvatarProps) {
  const url = usePhoto(login);

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-accent text-white flex items-center justify-center font-semibold flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials(name)}
    </div>
  );
}
