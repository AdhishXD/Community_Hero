export interface MockPhotoOption {
  id: string;
  label: string;
  url: string;
  description: string;
}

export const MOCK_PHOTO_OPTIONS: MockPhotoOption[] = [
  {
    id: "photo-pothole",
    label: "Severe Pothole",
    url: "https://images.unsplash.com/photo-1599740831144-530ba115167f?q=80&w=600&auto=format&fit=crop",
    description: "Deep cavity in asphalt road posing heavy tires hazard."
  },
  {
    id: "photo-leak",
    label: "Pipeline Burst",
    url: "https://images.unsplash.com/photo-1518081461904-9d8f136351c2?q=80&w=600&auto=format&fit=crop",
    description: "Burst utility pipe unleashing water onto public pathway."
  },
  {
    id: "photo-streetlight",
    label: "Shattered Streetlamp",
    url: "https://images.unsplash.com/photo-1517059224940-d4af9eec41b7?q=80&w=600&auto=format&fit=crop",
    description: "Broken electrical overhead lighting fixture causing blackout."
  },
  {
    id: "photo-waste",
    label: "Trash Pileup",
    url: "https://images.unsplash.com/photo-1530587191325-3db32d826c18?q=80&w=600&auto=format&fit=crop",
    description: "Rotting plastic and municipal waste dumped near walkway."
  }
];
