import CrmLeadsView from '@/components/views/CrmView';

export const dynamic = 'force-dynamic';

export default function CrmPage() {
  return (
    <div className="w-full h-full">
      <CrmLeadsView />
    </div>
  );
}
