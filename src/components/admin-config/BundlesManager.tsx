import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Plus } from 'lucide-react';
import {
  BundleSummary,
  NgoBundleRow,
  useAdminConfigBundles,
  useCreateBundle,
  useUpdateBundle,
} from '@/hooks/useAdminConfigBundles';

const emptyForm = {
  name: '',
  region: '',
  notes: '',
  seedNgoId: '',
};

export default function BundlesManager() {
  const { data, isLoading, error } = useAdminConfigBundles();
  const createBundle = useCreateBundle();
  const updateBundle = useUpdateBundle();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<BundleSummary | null>(null);
  const [formState, setFormState] = useState(emptyForm);

  const ngos = data?.ngos ?? [];
  const bundles = data?.bundles ?? [];

  const ngoOptions = useMemo(() => {
    return ngos.map((ngo) => ({
      id: ngo.id,
      label: ngo.common_name || ngo.legal_name,
    }));
  }, [ngos]);

  const resetForm = () => {
    setFormState(emptyForm);
    setEditingBundle(null);
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const handleEdit = (bundle: BundleSummary) => {
    setEditingBundle(bundle);
    setFormState({
      name: bundle.name,
      region: bundle.region ?? '',
      notes: bundle.notes ?? '',
      seedNgoId: '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
      name: formState.name.trim(),
      region: formState.region.trim() || undefined,
      notes: formState.notes.trim() || undefined,
    };

    if (editingBundle) {
      await updateBundle.mutateAsync({
        previousName: editingBundle.name,
        ...payload,
      });
    } else {
      await createBundle.mutateAsync({
        ...payload,
        seedNgoId: formState.seedNgoId,
      });
    }

    setDialogOpen(false);
    resetForm();
  };

  const getNgoLabel = (bundle: BundleSummary, ngoList: NgoBundleRow[]) => {
    const sample = ngoList.find((ngo) => ngo.bundle === bundle.name);
    return sample ? sample.common_name || sample.legal_name : '—';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Bundles</CardTitle>
            <CardDescription>
              Bundles are derived from NGO bundle values. Updates apply to all NGOs in the bundle.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add bundle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingBundle ? 'Edit bundle' : 'Add bundle'}</DialogTitle>
                <DialogDescription>
                  Assign a bundle to an NGO to create it. Region and notes apply to all NGOs in that
                  bundle.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bundle_name">Bundle name</Label>
                  <Input
                    id="bundle_name"
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </div>
                {!editingBundle && (
                  <div className="space-y-2">
                    <Label htmlFor="bundle_seed">Assign to NGO</Label>
                    <Select
                      value={formState.seedNgoId}
                      onValueChange={(value) =>
                        setFormState((prev) => ({ ...prev, seedNgoId: value }))
                      }
                    >
                      <SelectTrigger id="bundle_seed">
                        <SelectValue placeholder="Select an NGO" />
                      </SelectTrigger>
                      <SelectContent>
                        {ngoOptions.map((ngo) => (
                          <SelectItem key={ngo.id} value={ngo.id}>
                            {ngo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="bundle_region">Region</Label>
                  <Input
                    id="bundle_region"
                    value={formState.region}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, region: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bundle_notes">Notes</Label>
                  <Textarea
                    id="bundle_notes"
                    value={formState.notes}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, notes: event.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !formState.name.trim() ||
                    (!editingBundle && !formState.seedNgoId)
                  }
                >
                  {editingBundle ? 'Save changes' : 'Create bundle'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading bundles...</p>}
        {error && (
          <p className="text-sm text-destructive">
            {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bundle</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Sample NGO</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles.map((bundle) => (
                <TableRow key={bundle.name}>
                  <TableCell className="font-medium">{bundle.name}</TableCell>
                  <TableCell>{bundle.region ?? '—'}</TableCell>
                  <TableCell className="max-w-[240px] truncate">
                    {bundle.notes ?? '—'}
                  </TableCell>
                  <TableCell>{getNgoLabel(bundle, ngos)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(bundle)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
