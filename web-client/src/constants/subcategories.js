import { ShieldAlert, UserX, Users, Flame, Ban } from 'lucide-react';

// Subcategory tag chip configurations matching the classifier's model labels
// (classifier-service/inference/classifier.py). "toxic" is the headline label,
// so it never appears as a subcategory.
export const SUBCATEGORY_CONFIG = {
  severe_toxic: {
    label: 'Severe Toxic',
    icon: Flame,
    bg: 'bg-orange-500/15',
    text: 'text-orange-300',
    border: 'border-orange-500/30',
  },
  obscene: {
    label: 'Obscene',
    icon: Ban,
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-300',
    border: 'border-yellow-500/30',
  },
  threat: {
    label: 'Threat',
    icon: ShieldAlert,
    bg: 'bg-red-500/15',
    text: 'text-red-300',
    border: 'border-red-500/30',
  },
  insult: {
    label: 'Insult',
    icon: UserX,
    bg: 'bg-purple-500/15',
    text: 'text-purple-300',
    border: 'border-purple-500/30',
  },
  identity_hate: {
    label: 'Identity Hate',
    icon: Users,
    bg: 'bg-pink-500/15',
    text: 'text-pink-300',
    border: 'border-pink-500/30',
  },
};
