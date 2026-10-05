import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useDb } from '../../src/db/DbProvider';
import { GroupForm, emptyGroupForm } from '../../src/features/groups/GroupForm';
import { loadGroupFormValues, type GroupFormValues } from '../../src/features/groups/saveGroup';

/** Handles both `/group/new` (id "new") and `/group/<id>`. */
export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDb();
  const isNew = id === 'new';
  const [initial, setInitial] = useState<GroupFormValues | null>(isNew ? emptyGroupForm : null);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    void loadGroupFormValues(db, id).then((values) => {
      if (cancelled) return;
      if (values) setInitial(values);
      else router.back();
    });
    return () => {
      cancelled = true;
    };
  }, [db, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!initial) return null;
  return <GroupForm initial={initial} groupId={isNew ? undefined : id} onSaved={() => router.back()} onCancel={() => router.back()} />;
}
