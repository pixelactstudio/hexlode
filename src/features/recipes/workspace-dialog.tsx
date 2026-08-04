import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { ButtonGroup } from '@astryxdesign/core/ButtonGroup'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { VStack } from '@astryxdesign/core/Stack'
import { Switch } from '@astryxdesign/core/Switch'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Token } from '@astryxdesign/core/Token'
import { useEffect, useState } from 'react'

import { usePrivacy } from '#/features/privacy/privacy-provider'
import { listRecipes, saveRecipe } from '#/features/recipes/local-store'
import { exportRecipe, importRecipe } from '#/features/recipes/recipe'
import type { Recipe } from '#/features/recipes/types'
import { createId } from '#/lib/create-id'

interface WorkspaceDialogProps {
  createCurrentRecipe: (name: string, kind: Recipe['kind']) => Recipe
  isOpen: boolean
  onApplyRecipe: (recipe: Recipe) => void
  onOpenChange: (isOpen: boolean) => void
}

function downloadRecipe(recipe: Recipe) {
  const blob = new Blob([exportRecipe(recipe)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${recipe.name.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase() || 'recipe'}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 0)
}

export function WorkspaceDialog({
  createCurrentRecipe,
  isOpen,
  onApplyRecipe,
  onOpenChange,
}: WorkspaceDialogProps) {
  const privacy = usePrivacy()
  const [tab, setTab] = useState('recipes')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('My image recipe')
  const [kind, setKind] = useState<Recipe['kind']>('recipe')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const selected = recipes.find((recipe) => recipe.id === selectedId) ?? null

  useEffect(() => {
    if (!isOpen) return
    listRecipes()
      .then(setRecipes)
      .catch((reason) => {
        setMessage(reason instanceof Error ? reason.message : 'Saved recipes could not load.')
      })
  }, [isOpen])

  async function persist(recipe: Recipe) {
    const saved = await saveRecipe(recipe)
    setRecipes((current) => [saved, ...current.filter(({ id }) => id !== saved.id)])
    setSelectedId(saved.id)
    setMessage(`${saved.name} saved locally.`)
  }

  function saveCurrent() {
    if (privacy.mode === 'private') return
    persist(createCurrentRecipe(name, kind)).catch((reason) => {
      setMessage(reason instanceof Error ? reason.message : 'The recipe could not be saved.')
    })
  }

  function renameSelected() {
    if (!selected || privacy.mode === 'private') return
    persist({ ...selected, name, updatedAt: new Date().toISOString() }).catch((reason) => {
      setMessage(reason instanceof Error ? reason.message : 'The recipe could not be renamed.')
    })
  }

  function duplicateSelected() {
    if (!selected || privacy.mode === 'private') return
    const timestamp = new Date().toISOString()
    persist({
      ...selected,
      id: createId(),
      name: `${selected.name} copy`,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).catch((reason) => {
      setMessage(reason instanceof Error ? reason.message : 'The recipe could not be duplicated.')
    })
  }

  async function importSelected(file: File | File[] | null) {
    const nextFile = Array.isArray(file) ? file[0] : file
    setImportFile(nextFile ?? null)
    if (!nextFile) return

    try {
      const parsed = importRecipe(await nextFile.text())
      const imported = { ...parsed, id: createId(), updatedAt: new Date().toISOString() }
      if (privacy.mode === 'local') await persist(imported)
      onApplyRecipe(imported)
      setMessage(`${imported.name} imported and applied.`)
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'The recipe file is invalid.')
    }
  }

  const recipeContent = (
    <VStack gap={5}>
      {privacy.mode === 'private' ? (
        <Banner
          status="info"
          title="Private Session"
          description="Recipes can be imported for this session, but saves and changes are not retained."
        />
      ) : null}
      {message ? <Banner status="info" title="Workspace update" description={message} /> : null}
      <VStack gap={3}>
        <TextInput label="Recipe name" value={name} onChange={setName} width="100%" />
        <SegmentedControl
          label="Save type"
          value={kind}
          onChange={(value) => setKind(value as Recipe['kind'])}
          layout="fill"
        >
          <SegmentedControlItem value="recipe" label="Recipe" />
          <SegmentedControlItem value="macro" label="Macro preset" />
        </SegmentedControl>
        <Button
          label="Save current workflow"
          variant="primary"
          width="100%"
          isDisabled={privacy.mode === 'private' || !name.trim()}
          onClick={saveCurrent}
        />
      </VStack>
      {recipes.length ? (
        <List density="compact" hasDividers header={<Text type="label">Saved locally</Text>}>
          {recipes.map((recipe) => (
            <ListItem
              key={recipe.id}
              label={recipe.name}
              description={`${recipe.execution.format.toUpperCase()} · ${recipe.execution.maxDimension}px · ${recipe.execution.quality}%`}
              endContent={<Token label={recipe.kind} size="sm" color="gray" />}
              isSelected={recipe.id === selectedId}
              onClick={() => {
                setSelectedId(recipe.id)
                setName(recipe.name)
              }}
            />
          ))}
        </List>
      ) : (
        <EmptyState
          title="No saved recipes"
          description="Save the current workflow to reuse it in another session."
          isCompact
        />
      )}
      <ButtonGroup label="Selected recipe" size="sm">
        <Button
          label="Apply"
          variant="secondary"
          isDisabled={!selected}
          onClick={() => selected && onApplyRecipe(selected)}
        />
        <Button
          label="Rename"
          variant="secondary"
          isDisabled={!selected || privacy.mode === 'private' || !name.trim()}
          onClick={renameSelected}
        />
        <Button
          label="Duplicate"
          variant="secondary"
          isDisabled={!selected || privacy.mode === 'private'}
          onClick={duplicateSelected}
        />
        <Button
          label="Export"
          variant="secondary"
          isDisabled={!selected}
          onClick={() => selected && downloadRecipe(selected)}
        />
      </ButtonGroup>
      <FileInput
        label="Import recipe"
        value={importFile}
        onChange={importSelected}
        accept="application/json,.json"
        maxSize={1024 * 1024}
        description="Versioned Hexlode recipe JSON, up to 1 MB."
        width="100%"
      />
    </VStack>
  )

  const privacyContent = (
    <VStack gap={5}>
      {privacy.error ? (
        <Banner
          status="warning"
          title="Preference storage unavailable"
          description={privacy.error}
        />
      ) : null}
      <SegmentedControl
        label="Workspace mode"
        value={privacy.mode}
        onChange={(value) => privacy.setMode(value as 'local' | 'private')}
        layout="fill"
      >
        <SegmentedControlItem value="local" label="Local Workspace" />
        <SegmentedControlItem value="private" label="Private Session" />
      </SegmentedControl>
      <Text color="secondary">
        {privacy.mode === 'local'
          ? 'Recipes, preferences, and file-free run summaries are stored in this browser.'
          : 'Recipes and run summaries from this session are not stored.'}
      </Text>
      <Switch
        label="Airgap Mode"
        description="Disable analytics and every application-controlled remote capability. Processing remains on this device."
        value={privacy.airgap}
        onChange={privacy.setAirgap}
        labelSpacing="spread"
        width="100%"
      />
      <Banner
        status="success"
        title="Image bytes stay local"
        description="File contents, names, paths, metadata, thumbnails, and file-linked identifiers are excluded from analytics and backend services."
      />
    </VStack>
  )

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={720} maxHeight="88vh">
      <Layout
        header={
          <DialogHeader
            title="Workspace"
            subtitle="Recipes and local privacy controls"
            onOpenChange={onOpenChange}
          />
        }
        content={
          <LayoutContent padding={5}>
            <VStack gap={5}>
              <TabList value={tab} onChange={setTab} hasDivider layout="fill">
                <Tab value="recipes" label="Recipes" />
                <Tab value="privacy" label="Privacy" />
              </TabList>
              {tab === 'recipes' ? recipeContent : privacyContent}
            </VStack>
          </LayoutContent>
        }
      />
    </Dialog>
  )
}
