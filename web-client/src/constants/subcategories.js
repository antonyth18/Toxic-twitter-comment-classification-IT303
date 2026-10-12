import { ShieldAlert, UserX, Users, Flame, Ban } from 'lucide-react';

// Subcategory tag chip configurations matching the classifier's model labels
// (classifier-service/inference/classifier.py). "toxic" is the headline label,
// so it never appears as a subcategory.
export const SUBCATEGORY_CONFIG = {
  severe_toxic: {
    label: 'Severe Toxic',
    icon: Flame,
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  obscene: {
    label: 'Obscene',
    icon: Ban,
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  threat: {
    label: 'Threat',
    icon: ShieldAlert,
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  insult: {
    label: 'Insult',
    icon: UserX,
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  identity_hate: {
    label: 'Identity Hate',
    icon: Users,
    bg: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-200',
  },
};
